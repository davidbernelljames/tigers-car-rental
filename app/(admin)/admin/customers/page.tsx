import { prisma } from "@/lib/prisma";
import { CustomerManager } from "@/components/admin/customer-manager";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    include: { bookings: { select: { bookingId: true, bookingStatus: true, totalCost: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <CustomerManager
      initialCustomers={customers.map((c) => ({
        customerId: c.customerId,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        address: c.address,
        drivingPermitNumber: c.drivingPermitNumber,
        bookingCount: c.bookings.length,
        totalSpent: c.bookings
          .filter((b) => b.bookingStatus !== "CANCELLED")
          .reduce((sum, b) => sum + Number(b.totalCost), 0),
      }))}
    />
  );
}
