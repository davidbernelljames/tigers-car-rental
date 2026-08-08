import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ReportResult } from "@/lib/reports";

// ============================================================================
// A6 Reports — PDF export template.
//
// Matches the visual conventions already established in
// lib/rental-agreement.tsx (Helvetica, the same font sizes and grey tones)
// rather than inventing a new style, so a report and a rental agreement
// look like they came from the same system.
// ============================================================================

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#666666", marginTop: 3, marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
    paddingBottom: 3,
  },
  row: { flexDirection: "row", paddingVertical: 3 },
  rowAlt: { flexDirection: "row", paddingVertical: 3, backgroundColor: "#f7f7f7" },
  cellLabel: { flex: 2, fontSize: 9 },
  cellValue: { flex: 1, fontSize: 9, textAlign: "right" },
  summaryItem: { width: "50%", marginBottom: 6 },
  summaryLabel: { fontSize: 8, color: "#666666" },
  summaryValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: "#999999", textAlign: "center" },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  return (
    <View style={alt ? styles.rowAlt : styles.row}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

export interface ReportPdfProps {
  data: ReportResult;
  from?: string;
  to?: string;
  generatedAt: Date;
}

function ReportDocument({ data, from, to, generatedAt }: ReportPdfProps) {
  const periodLabel =
    from || to
      ? `${from ? new Date(from).toLocaleDateString("en-GB") : "the beginning"} to ${to ? new Date(to).toLocaleDateString("en-GB") : "now"}`
      : "all time";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Tiger's Car Rental</Text>
        <Text style={styles.subtitle}>
          Financial and Operational Report — {periodLabel} — Generated {generatedAt.toLocaleString("en-GB")}
        </Text>

        <Section title="REP-01 · Financial Transaction Report">
          <View style={styles.row}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Revenue</Text>
              <Text style={styles.summaryValue}>TT${data.totalRevenue.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Average Booking Value</Text>
              <Text style={styles.summaryValue}>TT${data.avgBookingValue.toFixed(2)}</Text>
            </View>
          </View>
          <Row label="Refunds Outstanding (count)" value={String(data.refundsOutstandingCount)} />
          <Row label="Refunds Outstanding (total)" value={`TT$${data.refundsOutstandingTotal.toFixed(2)}`} alt />
        </Section>

        <Section title="REP-02 · Booking Status Report">
          {data.statusCounts.map((s, i) => (
            <Row key={s.status} label={s.status} value={String(s.count)} alt={i % 2 === 1} />
          ))}
        </Section>

        <Section title="REP-03 · Fleet Utilisation Report">
          {data.utilisation.map((u, i) => (
            <Row
              key={u.vehicleId}
              label={u.label}
              value={`${u.utilisationPercent}% (${u.bookingCount} bookings)`}
              alt={i % 2 === 1}
            />
          ))}
        </Section>

        <Section title="REP-04 · Customer Activity Report">
          <Row label="Repeat Customers" value={String(data.repeatCustomers)} />
          {data.customerActivity.map((c, i) => (
            <Row
              key={c.customerId}
              label={`${c.name} (${c.bookingCount} bookings)`}
              value={`TT$${c.totalSpent.toFixed(2)}`}
              alt={i % 2 === 1}
            />
          ))}
        </Section>

        <Section title="REP-05 · Maintenance Schedule Report">
          <Row label="Upcoming" value={String(data.upcomingMaintenance)} />
          <Row label="Completed" value={String(data.completedMaintenance)} alt />
        </Section>

        <Section title="REP-06 · Promotions Effectiveness Report">
          {data.promotionEffectiveness.map((p, i) => (
            <Row
              key={p.code}
              label={`${p.code} (${p.discountPercent}% off, ${p.isActive ? "active" : "inactive"})`}
              value={`${p.bookingsDuringWindow} bookings`}
              alt={i % 2 === 1}
            />
          ))}
        </Section>

        <Text style={styles.footer}>
          Tiger's Car Rental — Piarco, Trinidad and Tobago — Generated from live system data
        </Text>
      </Page>
    </Document>
  );
}

export async function generateReportPdf(props: ReportPdfProps): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...props} />);
}
