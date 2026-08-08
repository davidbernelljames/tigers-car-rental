import { prisma } from "@/lib/prisma";
import { formatVehicleWithDetails } from "@/lib/utils";

// ============================================================================
// A6 Financial & Operational Reports — computation logic.
//
// Extracted from the Reports page itself so the PDF export route can call
// the exact same function rather than duplicate this logic — a duplicated
// copy would risk silently drifting out of sync with what's shown on
// screen, which is exactly the kind of inconsistency a report export
// should never have.
// ============================================================================

export interface ReportResult {
  totalRevenue: number;
  avgBookingValue: number;
  refundsOutstandingCount: number;
  refundsOutstandingTotal: number;
  statusCounts: { status: string; count: number }[];
  utilisation: { vehicleId: number; label: string; utilisationPercent: number; bookingCount: number }[];
  customerActivity: { customerId: number; name: string; bookingCount: number; totalSpent: number }[];
  repeatCustomers: number;
  totalCustomers: number;
  upcomingMaintenance: number;
  completedMaintenance: number;
  promotionEffectiveness: { code: string; discountPercent: number; bookingsDuringWindow: number; isActive: boolean }[];
  windowStart: Date;
  windowEnd: Date;
}

export async function computeReports(from?: string, to?: string): Promise<ReportResult> {
  const [bookings, vehicles, customers, maintenanceRecords, promotions] = await Promise.all([
    prisma.booking.findMany({ include: { customer: true, vehicle: true } }),
    prisma.vehicle.findMany(),
    prisma.customer.findMany({ include: { bookings: true } }),
    prisma.maintenanceRecord.findMany({ include: { vehicle: true } }),
    prisma.promotion.findMany(),
  ]);

  const rangeStart = from ? new Date(from) : null;
  const rangeEnd = to ? new Date(to) : null;
  const inRange = (date: Date) =>
    (!rangeStart || date >= rangeStart) && (!rangeEnd || date <= rangeEnd);

  const scopedBookings = rangeStart || rangeEnd ? bookings.filter((b) => inRange(b.pickupDate)) : bookings;
  const nonCancelled = scopedBookings.filter((b) => b.bookingStatus !== "CANCELLED");

  const totalRevenue = nonCancelled.reduce((sum, b) => sum + Number(b.amountPaid), 0);
  const avgBookingValue = nonCancelled.length ? totalRevenue / nonCancelled.length : 0;
  const refundsOutstanding = bookings.filter((b) => b.refundDue && !b.refundedAt);
  const refundsOutstandingTotal = refundsOutstanding.reduce(
    (sum, b) => sum + Number(b.refundDue),
    0
  );

  const statusCounts = ["PENDING", "CONFIRMED", "ON_RENTAL", "COMPLETED", "CANCELLED"].map(
    (status) => ({
      status,
      count: scopedBookings.filter((b) => b.bookingStatus === status).length,
    })
  );

  const defaultWindowDays = 90;
  const windowStart = rangeStart ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - defaultWindowDays);
    return d;
  })();
  const windowEnd = rangeEnd ?? new Date();
  const windowDays = Math.max(
    1,
    Math.round((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24))
  );

  const utilisation = vehicles.map((v) => {
    const vehicleBookings = nonCancelled.filter(
      (b) => b.vehicleId === v.vehicleId && b.returnDate >= windowStart && b.pickupDate <= windowEnd
    );
    const bookedDays = vehicleBookings.reduce((sum, b) => {
      const start = b.pickupDate > windowStart ? b.pickupDate : windowStart;
      const end = b.returnDate < windowEnd ? b.returnDate : windowEnd;
      const days = Math.max(
        0,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      );
      return sum + days;
    }, 0);
    return {
      vehicleId: v.vehicleId,
      label: formatVehicleWithDetails(v),
      utilisationPercent: Math.min(100, Math.round((bookedDays / windowDays) * 100)),
      bookingCount: vehicleBookings.length,
    };
  });

  const customerActivity = customers
    .map((c) => {
      const qualifying = c.bookings.filter(
        (b) => b.bookingStatus !== "CANCELLED" && inRange(b.pickupDate)
      );
      return {
        customerId: c.customerId,
        name: `${c.firstName} ${c.lastName}`,
        bookingCount: qualifying.length,
        totalSpent: qualifying.reduce((sum, b) => sum + Number(b.amountPaid), 0),
      };
    })
    .filter((c) => c.bookingCount > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);
  const repeatCustomers = customers.filter(
    (c) =>
      c.bookings.filter((b) => b.bookingStatus !== "CANCELLED" && inRange(b.pickupDate)).length > 1
  ).length;

  const upcomingMaintenance = maintenanceRecords.filter((r) => r.status === "SCHEDULED").length;
  const completedMaintenance = maintenanceRecords.filter((r) => r.status === "COMPLETED").length;

  const now = new Date();
  const promotionEffectiveness = promotions.map((p) => {
    const relatedBookings = nonCancelled.filter(
      (b) =>
        b.vehicle.category === p.vehicleCategory &&
        (!p.vehicleId || b.vehicleId === p.vehicleId) &&
        b.createdAt >= p.startDate &&
        b.createdAt <= p.expiryDate
    );
    return {
      code: p.code,
      discountPercent: Number(p.discountPercent),
      bookingsDuringWindow: relatedBookings.length,
      isActive: p.startDate <= now && p.expiryDate >= now,
    };
  });

  return {
    totalRevenue,
    avgBookingValue,
    refundsOutstandingCount: refundsOutstanding.length,
    refundsOutstandingTotal,
    statusCounts,
    utilisation,
    customerActivity,
    repeatCustomers,
    totalCustomers: customers.length,
    upcomingMaintenance,
    completedMaintenance,
    promotionEffectiveness,
    windowStart,
    windowEnd,
  };
}
