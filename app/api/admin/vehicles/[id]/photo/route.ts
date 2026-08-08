import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

// ============================================================================
// A4 Fleet Management — vehicle photo upload.
//
// A separate endpoint from the main vehicle create/update route rather than
// folding this into it, since that route's payload is plain JSON and a file
// upload needs multipart form data — keeping them separate avoids
// restructuring an already-working endpoint just to accommodate a file.
//
// Follows the exact same Storage pattern already established in
// lib/issue-agreement.ts for rental agreement PDFs: the service-role client
// (bypasses RLS, since this is an authenticated staff action with no
// customer session to authorise against), upsert: true so re-uploading a
// photo for the same vehicle simply replaces it rather than erroring.
// ============================================================================

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId)) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { vehicleId } });
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Photo must be a JPEG, PNG, or WebP image." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Photo must be under 5MB." }, { status: 400 });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  // Timestamp in the filename, not just the vehicle ID, so a stale cached
  // copy of the old photo can't linger client-side after a re-upload —
  // the URL itself changes, forcing a fresh fetch.
  const filePath = `${vehicleId}-${Date.now()}.${extension}`;

  const supabase = createServiceRoleClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("vehicle-photos")
    .upload(filePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error(`[A4] Vehicle photo upload failed for vehicle ${vehicleId}:`, uploadError.message);
    return NextResponse.json(
      { error: "Could not upload the photo. Please try again." },
      { status: 502 }
    );
  }

  const { data: publicUrlData } = supabase.storage.from("vehicle-photos").getPublicUrl(filePath);
  const photoUrl = publicUrlData.publicUrl;

  const updated = await prisma.vehicle.update({
    where: { vehicleId },
    data: { photoUrl },
  });

  // [Corrected] Prisma's Decimal type serializes to a string over JSON, not
  // a number — the main vehicle PATCH route already accounts for this
  // (see the sibling route.ts), but this endpoint returned the raw record
  // as-is. The fleet table's local state then held a string dailyRate for
  // whichever vehicle a photo was just uploaded for, and calling .toFixed()
  // on it in the price column threw at render time. Same fix as the
  // established pattern next door.
  return NextResponse.json({ ...updated, dailyRate: Number(updated.dailyRate) });
}

// [New] Removes an existing vehicle photo — both the file itself from
// Storage and the reference on the vehicle record. Deleting the Storage
// object rather than just clearing photoUrl avoids leaving an orphaned
// file behind with nothing pointing to it.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId)) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { vehicleId } });
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (vehicle.photoUrl) {
    const supabase = createServiceRoleClient();
    // The public URL embeds the bucket-relative path after the bucket
    // name — extracted rather than reconstructed, so this works
    // regardless of exactly how the filename was generated at upload time.
    const marker = "/vehicle-photos/";
    const idx = vehicle.photoUrl.indexOf(marker);
    if (idx !== -1) {
      const filePath = vehicle.photoUrl.slice(idx + marker.length);
      const { error: removeError } = await supabase.storage
        .from("vehicle-photos")
        .remove([filePath]);
      if (removeError) {
        // Not fatal — an orphaned Storage file is a minor cleanup issue,
        // not a reason to block the customer-visible outcome the person
        // actually asked for, the photo no longer showing on this vehicle.
        console.error(`[A4] Vehicle photo file removal failed for vehicle ${vehicleId}:`, removeError.message);
      }
    }
  }

  const updated = await prisma.vehicle.update({
    where: { vehicleId },
    data: { photoUrl: null },
  });

  return NextResponse.json({ ...updated, dailyRate: Number(updated.dailyRate) });
}
