import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeReports } from "@/lib/reports";
import { ReportExportButtons } from "@/components/admin/report-export-buttons";

export const dynamic = "force-dynamic";

// A6 Financial & Operational Reports. Owner-only per middleware. Six reports
// (REP-01 through REP-06), computed directly from real data rather than
// pre-aggregated — this is a small operation, so a live query per report is
// simpler and always correct, with no aggregation table to keep in sync.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const rangeStart = from ? new Date(from) : null;
  const rangeEnd = to ? new Date(to) : null;
  const {
    totalRevenue,
    avgBookingValue,
    refundsOutstandingCount,
    refundsOutstandingTotal,
    statusCounts,
    utilisation,
    customerActivity,
    repeatCustomers,
    totalCustomers,
    upcomingMaintenance,
    completedMaintenance,
    promotionEffectiveness,
    windowStart,
    windowEnd,
  } = await computeReports(from, to);

  const windowDaysLabel = rangeStart || rangeEnd
    ? `${windowStart.toLocaleDateString("en-GB")} – ${windowEnd.toLocaleDateString("en-GB")}`
    : "last 90 days";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Reports</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Financial and operational reporting, computed from live data
            {(rangeStart || rangeEnd) && " — filtered to the selected date range"}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* Plain GET form — no client JS needed. Submitting re-renders
              this Server Component with the new range in the URL. */}
          <form method="get" className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">From</label>
              <input
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">To</label>
              <input
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-9 rounded-md bg-neutral-900 text-white text-sm px-3 hover:bg-neutral-800"
            >
              Apply
            </button>
            {(from || to) && (
              <a
                href="/admin/reports"
                className="h-9 flex items-center text-sm text-neutral-400 underline px-1"
              >
                Clear
              </a>
            )}
          </form>

          <ReportExportButtons
            from={from}
            to={to}
            data={{
              totalRevenue,
              avgBookingValue,
              refundsOutstandingCount,
              refundsOutstandingTotal,
              statusCounts,
              utilisation,
              customerActivity,
              repeatCustomers,
              upcomingMaintenance,
              completedMaintenance,
              promotionEffectiveness,
            }}
          />
        </div>
      </div>

      {/* REP-01 */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          REP-01 · Financial Transaction Report
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Revenue" value={`TT$${totalRevenue.toFixed(2)}`} />
          <StatCard label="Average Booking Value" value={`TT$${avgBookingValue.toFixed(2)}`} />
          <StatCard
            label="Refunds Outstanding"
            value={`TT$${refundsOutstandingTotal.toFixed(2)}`}
            highlight={refundsOutstandingCount > 0}
          />
        </div>
      </section>

      {/* REP-02 */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          REP-02 · Booking Status Report
        </h2>
        <Card>
          <CardContent className="pt-6 flex flex-wrap gap-3">
            {statusCounts.map((s) => (
              <div key={s.status} className="flex items-center gap-2">
                <Badge
                  variant={
                    s.status === "CANCELLED"
                      ? "maintenance"
                      : s.status === "COMPLETED"
                        ? "neutral"
                        : "available"
                  }
                >
                  {s.status.replace("_", " ")}
                </Badge>
                <span className="text-neutral-900 font-semibold">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* REP-03 */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          REP-03 · Fleet Utilisation Report ({windowDaysLabel})
        </h2>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Bookings</th>
                  <th className="px-4 py-3 font-medium">Utilisation</th>
                </tr>
              </thead>
              <tbody>
                {utilisation.map((u) => (
                  <tr key={u.vehicleId} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">{u.label}</td>
                    <td className="px-4 py-3 text-neutral-600">{u.bookingCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-customer"
                            style={{ width: `${u.utilisationPercent}%` }}
                          />
                        </div>
                        <span className="text-neutral-600 text-xs">{u.utilisationPercent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* REP-04 */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          REP-04 · Customer Activity Report
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <StatCard label="Repeat Customers" value={repeatCustomers.toString()} />
          <StatCard label="Total Customers" value={totalCustomers.toString()} />
        </div>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Bookings</th>
                  <th className="px-4 py-3 font-medium">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {customerActivity.map((c) => (
                  <tr key={c.customerId} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">{c.name}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.bookingCount}</td>
                    <td className="px-4 py-3 text-neutral-600">TT${c.totalSpent.toFixed(2)}</td>
                  </tr>
                ))}
                {customerActivity.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                      No customer activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* REP-05 */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          REP-05 · Maintenance Schedule Report
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Upcoming Service" value={upcomingMaintenance.toString()} />
          <StatCard label="Completed Service" value={completedMaintenance.toString()} />
        </div>
      </section>

      {/* REP-06 */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          REP-06 · Promotions Effectiveness Report
        </h2>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Discount</th>
                  <th className="px-4 py-3 font-medium">Bookings During Window</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {promotionEffectiveness.map((p) => (
                  <tr key={p.code} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.code}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.discountPercent}%</td>
                    <td className="px-4 py-3 text-neutral-600">{p.bookingsDuringWindow}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.isActive ? "available" : "neutral"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {promotionEffectiveness.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                      No promotions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-neutral-500 text-sm">{label}</p>
        <p
          className={`text-2xl font-bold mt-1 ${
            highlight ? "text-status-maintenance" : "text-neutral-900"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
