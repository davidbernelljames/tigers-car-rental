import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import { formatVehicleWithDetails } from "@/lib/utils";

export const dynamic = "force-dynamic";

// STAFF_AGENT's home screen — this role corresponds to the "Admin Assistant"
// stakeholder in the SS1 Stakeholder Register. Deliberately shows only
// today's operational
// picture — no revenue, no refunds, no reports — matching the SS1 role
// definition: "no financials or settings". The full Bookings screen (linked
// below) is still reachable for anything beyond today, and IS financial-free
// itself when viewed as staff (see BookingsManager's isOwner prop).
export default async function StaffHomePage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [pickupsToday, returnsToday] = await Promise.all([
    prisma.booking.findMany({
      where: { pickupDate: { gte: todayStart, lt: todayEnd }, bookingStatus: "CONFIRMED" },
      include: { customer: true, vehicle: true },
      orderBy: { pickupDate: "asc" },
    }),
    prisma.booking.findMany({
      where: { returnDate: { gte: todayStart, lt: todayEnd }, bookingStatus: "ON_RENTAL" },
      include: { customer: true, vehicle: true },
      orderBy: { returnDate: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">My Day</h1>
      <p className="text-neutral-500 text-sm mb-6">
        {todayStart.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Pickups Today ({pickupsToday.length})
          </h2>
          <div className="space-y-3">
            {pickupsToday.map((b) => (
              <Card key={b.bookingId}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-neutral-900">{b.bookingRef}</p>
                    <Badge variant="available">Confirmed</Badge>
                  </div>
                  <p className="text-sm text-neutral-600 mt-1">
                    {formatVehicleWithDetails(b.vehicle)} — {b.customer.firstName}{" "}
                    {b.customer.lastName}
                  </p>
                  <p className="text-xs text-neutral-400">{b.customer.phone}</p>
                </CardContent>
              </Card>
            ))}
            {pickupsToday.length === 0 && (
              <p className="text-sm text-neutral-400 py-4">No pickups scheduled today.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Returns Today ({returnsToday.length})
          </h2>
          <div className="space-y-3">
            {returnsToday.map((b) => (
              <Card key={b.bookingId}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-neutral-900">{b.bookingRef}</p>
                    <Badge variant="onRental">On Rental</Badge>
                  </div>
                  <p className="text-sm text-neutral-600 mt-1">
                    {formatVehicleWithDetails(b.vehicle)} — {b.customer.firstName}{" "}
                    {b.customer.lastName}
                  </p>
                  <p className="text-xs text-neutral-400">{b.customer.phone}</p>
                </CardContent>
              </Card>
            ))}
            {returnsToday.length === 0 && (
              <p className="text-sm text-neutral-400 py-4">No returns due today.</p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-8">
        <Link href="/admin/bookings" className="text-sm text-customer underline">
          View all bookings →
        </Link>
      </div>
    </div>
  );
}
