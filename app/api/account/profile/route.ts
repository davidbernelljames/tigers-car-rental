import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolveCustomer } from "@/lib/customer-identity";
import { getStaffSession } from "@/lib/staff-auth";
import { profileUpdateSchema } from "@/lib/validations/account";

// S7 My Account — profile editing. Same staff-session guard as the
// bookings route: a staff member's own session should never be able to
// reach or edit a customer profile through this endpoint either.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const staffSession = await getStaffSession();
  if (staffSession) {
    return NextResponse.json({ error: "Not a customer account" }, { status: 403 });
  }

  const customer = await resolveCustomer({ id: user.id, email: user.email });
  if (!customer) {
    return NextResponse.json({ error: "No customer profile found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const updated = await prisma.customer.update({
    where: { customerId: customer.customerId },
    data: parsed.data,
  });

  return NextResponse.json({
    firstName: updated.firstName,
    lastName: updated.lastName,
    email: updated.email,
    phone: updated.phone,
    address: updated.address,
    drivingPermitNumber: updated.drivingPermitNumber,
  });
}
