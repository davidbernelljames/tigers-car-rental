"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";

// ============================================================================
// A6 Reports — export buttons.
//
// CSV is generated entirely client-side from the same figures already
// computed server-side for the on-screen report, and passed down as props
// — no extra request needed, since the data already exists on the page.
//
// PDF export instead calls a dedicated API route, since @react-pdf/renderer
// only runs server-side (it isn't a browser-safe library) — the same
// constraint the rental agreement PDF already works within.
// ============================================================================

interface ReportData {
  totalRevenue: number;
  avgBookingValue: number;
  refundsOutstandingCount: number;
  refundsOutstandingTotal: number;
  statusCounts: { status: string; count: number }[];
  utilisation: { label: string; utilisationPercent: number; bookingCount: number }[];
  customerActivity: { name: string; bookingCount: number; totalSpent: number }[];
  repeatCustomers: number;
  upcomingMaintenance: number;
  completedMaintenance: number;
  promotionEffectiveness: { code: string; discountPercent: number; bookingsDuringWindow: number; isActive: boolean }[];
}

function toCsv(data: ReportData): string {
  const lines: string[] = [];
  const row = (...cells: (string | number)[]) =>
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));

  row("Tiger's Car Rental — Report Export");
  row("");

  row("REP-01: Financial Transaction Report");
  row("Total Revenue", data.totalRevenue.toFixed(2));
  row("Average Booking Value", data.avgBookingValue.toFixed(2));
  row("Refunds Outstanding (count)", data.refundsOutstandingCount);
  row("Refunds Outstanding (total)", data.refundsOutstandingTotal.toFixed(2));
  row("");

  row("REP-02: Booking Status Report");
  row("Status", "Count");
  data.statusCounts.forEach((s) => row(s.status, s.count));
  row("");

  row("REP-03: Fleet Utilisation Report");
  row("Vehicle", "Utilisation %", "Booking Count");
  data.utilisation.forEach((u) => row(u.label, u.utilisationPercent, u.bookingCount));
  row("");

  row("REP-04: Customer Activity Report");
  row("Repeat Customers", data.repeatCustomers);
  row("Customer", "Booking Count", "Total Spent");
  data.customerActivity.forEach((c) => row(c.name, c.bookingCount, c.totalSpent.toFixed(2)));
  row("");

  row("REP-05: Maintenance Schedule Report");
  row("Upcoming", data.upcomingMaintenance);
  row("Completed", data.completedMaintenance);
  row("");

  row("REP-06: Promotions Effectiveness Report");
  row("Code", "Discount %", "Bookings During Window", "Active");
  data.promotionEffectiveness.forEach((p) =>
    row(p.code, p.discountPercent, p.bookingsDuringWindow, p.isActive ? "Yes" : "No")
  );

  return lines.join("\n");
}

export function ReportExportButtons({
  from,
  to,
  data,
}: {
  from?: string;
  to?: string;
  data: ReportData;
}) {
  const [generatingPdf, setGeneratingPdf] = React.useState(false);

  function handleCsvExport() {
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tigers-car-rental-report${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePdfExport() {
    setGeneratingPdf(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/reports/export-pdf?${params.toString()}`);
    setGeneratingPdf(false);
    if (!res.ok) {
      alert("Could not generate the PDF. Please try again.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tigers-car-rental-report${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-end gap-2">
      <button
        onClick={handleCsvExport}
        className="h-9 flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm hover:bg-neutral-50"
      >
        <Download className="h-3.5 w-3.5" /> CSV
      </button>
      <button
        onClick={handlePdfExport}
        disabled={generatingPdf}
        className="h-9 flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm hover:bg-neutral-50 disabled:opacity-50"
      >
        <FileText className="h-3.5 w-3.5" /> {generatingPdf ? "Generating…" : "PDF"}
      </button>
    </div>
  );
}
