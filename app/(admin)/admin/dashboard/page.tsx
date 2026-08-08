import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, TrendingUp, AlertCircle, Car } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    todaysPickups,
    todaysReturns,
    activeRentals,
    pendingBookings,
    refundsOwed,
    vehicles,
    thisMonthRevenue,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        pickupDate: { gte: todayStart, lt: todayEnd },
        bookingStatus: "CONFIRMED",
      },
    }),
    prisma.booking.count({
      where: {
        returnDate: { gte: todayStart, lt: todayEnd },
        bookingStatus: "ON_RENTAL",
      },
    }),
    prisma.booking.count({ where: { bookingStatus: "ON_RENTAL" } }),
    prisma.booking.count({ where: { bookingStatus: "PENDING" } }),
    prisma.booking.findMany({
      where: { refundDue: { not: null }, refundedAt: null },
      select: { refundDue: true },
    }),
    prisma.vehicle.findMany({ select: { status: true } }),
    prisma.booking.findMany({
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        bookingStatus: { not: "CANCELLED" },
      },
      select: { amountPaid: true },
    }),
  ]);

  const refundsOwedTotal = refundsOwed.reduce((sum, b) => sum + Number(b.refundDue), 0);
  const monthRevenue = thisMonthRevenue.reduce((sum, b) => sum + Number(b.amountPaid), 0);
  const availableCount = vehicles.filter((v) => v.status === "AVAILABLE").length;
  const inMaintenanceCount = vehicles.filter((v) => v.status === "IN_MAINTENANCE").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Dashboard</h1>
      <p className="text-neutral-500 text-sm mb-6">
        {todayStart.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={CalendarClock} label="Today's Pickups" value={todaysPickups} />
        <StatCard icon={CalendarClock} label="Today's Returns" value={todaysReturns} />
        <StatCard icon={Car} label="Active Rentals" value={activeRentals} />
        <StatCard icon={AlertCircle} label="Pending Bookings" value={pendingBookings} accent={pendingBookings > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-customer" />
              <h2 className="font-semibold text-neutral-900 text-sm">This Month</h2>
            </div>
            <p className="text-3xl font-bold text-neutral-900">TT${monthRevenue.toFixed(2)}</p>
            <p className="text-neutral-500 text-xs mt-1">Revenue from confirmed bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Car className="h-4 w-4 text-customer" />
              <h2 className="font-semibold text-neutral-900 text-sm">Fleet Status</h2>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-2xl font-bold text-status-available">{availableCount}</p>
                <p className="text-neutral-500 text-xs">Available</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-status-maintenance">{inMaintenanceCount}</p>
                <p className="text-neutral-500 text-xs">In Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {refundsOwedTotal > 0 && (
          <Card className="lg:col-span-2 border-status-maintenance/30">
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="font-semibold text-neutral-900 text-sm">Refunds Outstanding</p>
                <p className="text-2xl font-bold text-status-maintenance mt-1">
                  TT${refundsOwedTotal.toFixed(2)}
                </p>
              </div>
              <Link href="/admin/bookings" className="text-sm text-customer underline">
                View bookings →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Icon className={`h-4 w-4 mb-2 ${accent ? "text-status-onRental" : "text-neutral-400"}`} />
        <p className={`text-2xl font-bold ${accent ? "text-status-onRental" : "text-neutral-900"}`}>
          {value}
        </p>
        <p className="text-neutral-500 text-xs mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
