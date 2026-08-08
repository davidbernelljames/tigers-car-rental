import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";
import { customerUpdateSchema } from "@/lib/validations/admin";

// A5 Customer Records. Owner-only, matching middleware's OWNER_ONLY_PREFIXES
// — this screen surfaces every customer's contact details and full booking
// history, which is exactly the kind of personal-data access the SS1 role
// definition excludes from STAFF_AGENT.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = customerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid customer details" },
      { status: 400 }
    );
  }

  try {
    const customer = await prisma.customer.update({
      where: { customerId },
      data: parsed.data,
    });
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
}
