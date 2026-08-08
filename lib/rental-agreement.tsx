import React from "react";
import path from "path";
import fs from "fs";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatVehicleLabel } from "@/lib/utils";

// ============================================================================
// Rental agreement PDF — Algorithm A-02, Normal Flow steps 6-7.
//
// REBUILT to mirror Kadesh's actual paper "Car Rental Form" field-for-field
// and clause-for-clause, rather than an invented generic template. SS1 lists
// "Document Analysis: Customer Rental Agreement Form" as an explicit research
// method and ties this document directly to Gap G7 (Paper-based Rental
// Agreements) — so the digital version should be a faithful automation of
// the real artefact, not a fresh design.
//
// FIELD MAPPING TO THE PHYSICAL FORM:
//   RENTER NAME, ADDRESS, TELEPHONE     -> Customer firstName/lastName,
//                                          address, phone
//   DRIVING PERMIT#                     -> Customer drivingPermitNumber
//                                          (single free-text field, exactly
//                                          as on the paper form. An earlier
//                                          revision offered National ID /
//                                          Passport alternatives; that was
//                                          wrong — a rental requires proof
//                                          of entitlement to DRIVE, not
//                                          proof of identity. Free text
//                                          already accommodates overseas
//                                          visitors' licences and IDPs.)
//   VEHICLE MAKE, VEHICLE #, COLOR      -> Vehicle make/model, 
//                                          registrationNumber, color
//   MILEAGE, fuel fraction              -> Booking mileageAtPickup,
//                                          fuelLevelAtPickup — genuinely
//                                          unknown at PDF-generation time
//                                          (payment happens before the
//                                          customer ever sees the car), so
//                                          rendered as blank fillable lines
//                                          here, exactly as the paper form
//                                          has them, and populated digitally
//                                          by staff at pickup in a Phase 4
//                                          admin screen
//   RENTAL PERIOD start/end             -> Booking pickupDate/returnDate
//   FEES per day/week                   -> Vehicle dailyRate
//   DEPOSIT                             -> deliberately OMITTED. Kadesh's
//                                          deposit practice is discretionary
//                                          (waived for known customers,
//                                          assessed in person for new ones)
//                                          and is not a fixed rule the system
//                                          can or should state.
//   LATE FEE                            -> SystemSettings.lateReturnGraceHours
//                                          (1 hour) then a flat
//                                          SystemSettings.lateFeeAmount
//                                          (TT$100) — Kadesh's actual
//                                          confirmed policy, not tied to
//                                          which vehicle was rented
//   AMOUNT PAID                         -> Booking amountPaid (the full
//                                          rental, settled online at booking)
//   DRIVER / INDEMNIFICATION / VEHICLE
//   USE / RENTAL COMPENSATION /
//   BREAKDOWN-ACCIDENT-THEFT clauses    -> reproduced from the real form,
//                                          Kadesh's actual business terms
//   RENTER SIGNED / OWNER SIGNED /
//   WITNESS SIGNED                      -> all three kept per David's
//                                          decision, so a printed copy of
//                                          the digital agreement matches
//                                          the physical form exactly if
//                                          Kadesh chooses to print and
//                                          countersign at pickup
//
// The form number (e.g. "507") printed on Kadesh's physical pad is a
// sequential index across every paper form he has ever issued. The digital
// system deliberately does NOT continue that sequence — BookingRef
// (TCR-0001 style) starts fresh from the actual digital Booking table, with
// no relationship to the paper archive. Continuing "507" onward would imply
// false continuity with hundreds of prior paper transactions this system
// has no record of.
// ============================================================================

// [Root cause found] Previously passed @react-pdf/renderer a plain path
// string and let its own <Image src> resolver decide whether that string
// was a URL or a local file. Every test in Linux passed — repeatedly,
// including with the exact booking data that failed for real — because a
// Linux absolute path (/home/...) can never look like anything else. A
// Windows absolute path (C:\Users\...) starts with a drive letter and a
// colon, the same shape as a URL scheme (http:, file:), and very likely
// confused whatever heuristic @react-pdf/renderer uses to tell URLs and
// local paths apart — silently, since a failed <Image> just renders as
// blank space rather than throwing. This is exactly why the read-ability
// check below (fs.accessSync, which uses Node's own filesystem API
// directly) never caught it either: that tests a completely different code
// path from whatever @react-pdf/renderer's own resolver does internally.
//
// The fix removes the ambiguity entirely: the file is read into a Buffer
// directly, ourselves, using Node's fs — no string is ever handed to
// @react-pdf/renderer for it to guess about, so there is nothing left for
// its URL-vs-path detection to misinterpret, on any OS.
const LOGO_PATH = path.join(process.cwd(), "public", "tiger-logo.png");
let LOGO_BUFFER: Buffer | undefined;
try {
  LOGO_BUFFER = fs.readFileSync(LOGO_PATH);
} catch (err) {
  console.error(
    `[rental-agreement] Logo file not readable at ${LOGO_PATH} — the PDF will generate without it. ` +
      `If this is a deployed environment, confirm /public is included in the deployment output. Error:`,
    err
  );
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#E5843B",
    paddingBottom: 10,
    marginBottom: 14,
  },
  brandRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  logo: { width: 38, height: 41 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  brandContact: { fontSize: 8, color: "#666666", marginTop: 3 },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "right" },
  refText: { fontSize: 9, color: "#666666", textAlign: "right", marginTop: 2 },

  infoTable: {
    borderWidth: 1,
    borderColor: "#cccccc",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  infoRowLast: { flexDirection: "row" },
  infoLabel: {
    width: 110,
    padding: 5,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    backgroundColor: "#fafafa",
    borderRightWidth: 1,
    borderRightColor: "#cccccc",
  },
  infoValue: { flex: 1, padding: 5, fontSize: 9 },
  infoValueBlank: {
    flex: 1,
    padding: 5,
    fontSize: 9,
    color: "#999999",
    fontStyle: "italic",
  },

  sectionHeading: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
    marginTop: 8,
    marginBottom: 4,
  },

  feesGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  feeItem: { width: "50%", fontSize: 9, marginBottom: 3 },
  feeLabel: { fontFamily: "Helvetica-Bold" },

  clauseHeading: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
    marginTop: 9,
    marginBottom: 3,
  },
  clauseText: { fontSize: 8, lineHeight: 1.5, color: "#333333" },

  amountPaidRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#999999",
  },
  amountPaidLabel: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  amountPaidValue: { fontSize: 9, marginLeft: 6 },

  signatureBlock: { marginTop: 10 },
  signatureLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 16,
  },
  signatureLabel: { fontSize: 8, color: "#666666", width: 100 },
  signatureRule: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    height: 1,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#999999",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 6,
  },
});

export interface RentalAgreementData {
  bookingRef: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  drivingPermitNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleRegistrationNumber: string | null;
  pickupDate: Date;
  returnDate: Date;
  rentalDays: number;
  dailyRate: number;
  totalCost: number;
  amountPaid: number;
  lateReturnGraceHours: number;
  lateFeeAmount: number;
  cancellationPolicyNote: string;
  /** Null until staff record it at pickup — rendered as a blank fillable line. */
  mileageAtPickup: number | null;
  /** Null until staff record it at pickup — rendered as a blank fillable line. */
  fuelLevelAtPickup: string | null;
  transactionRef: string;
  businessName: string;
  businessPhone: string;
  businessPhoneSecondary?: string;
  businessEmail: string;
  businessAddress: string;
  generatedAt: Date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFuelLevel(level: string | null): string {
  if (!level) return "";
  switch (level) {
    case "FULL":
      return "Full";
    case "THREE_QUARTER":
      return "3/4";
    case "HALF":
      return "1/2";
    case "QUARTER":
      return "1/4";
    case "EMPTY":
      return "Empty";
    default:
      return level;
  }
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string | null;
  last?: boolean;
}) {
  return (
    <View style={last ? styles.infoRowLast : styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {value ? (
        <Text style={styles.infoValue}>{value}</Text>
      ) : (
        <Text style={styles.infoValueBlank}>
          To be completed at vehicle pickup
        </Text>
      )}
    </View>
  );
}

export function RentalAgreementDocument({ data }: { data: RentalAgreementData }) {

  return (
    <Document
      title={`Rental Agreement ${data.bookingRef}`}
      author={data.businessName}
    >
      <Page size={[595.28, 1400]} style={styles.page}>
        {/* ---- Header, matching the real form's letterhead ---- */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {LOGO_BUFFER && <Image src={LOGO_BUFFER} style={styles.logo} />}
            <View>
              <Text style={styles.brand}>{data.businessName.toUpperCase()}</Text>
              <Text style={styles.brandContact}>
                {data.businessPhone}
                {data.businessPhoneSecondary ? ` / ${data.businessPhoneSecondary}` : ""}
              </Text>
              <Text style={styles.brandContact}>{data.businessEmail}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.docTitle}>RENTAL AGREEMENT</Text>
            <Text style={styles.refText}>{data.bookingRef}</Text>
            <Text style={styles.refText}>{formatDate(data.generatedAt)}</Text>
          </View>
        </View>

        {/* ---- Renter block: RENTER NAME / ADDRESS / TELEPHONE / ID ---- */}
        <View style={styles.infoTable}>
          <InfoRow label="RENTER NAME" value={data.customerName} />
          <InfoRow label="ADDRESS" value={data.customerAddress} />
          <InfoRow label="TELEPHONE" value={data.customerPhone} />
          <InfoRow
            label="DRIVING PERMIT#"
            value={data.drivingPermitNumber}
            last
          />
        </View>

        {/* ---- RENTAL VEHICLE ---- */}
        <Text style={styles.sectionHeading}>RENTAL VEHICLE</Text>
        <View style={styles.infoTable}>
          <InfoRow
            label="VEHICLE MAKE"
            value={formatVehicleLabel({
              make: data.vehicleMake,
              model: data.vehicleModel,
            })}
          />
          <InfoRow label="VEHICLE #" value={data.vehicleRegistrationNumber} />
          <InfoRow
            label="MILEAGE"
            value={data.mileageAtPickup !== null ? `${data.mileageAtPickup} km` : null}
          />
          <InfoRow label="VEHICLE COLOR" value={data.vehicleColor} last />
        </View>

        {/* ---- RENTAL PERIOD ---- */}
        <Text style={styles.sectionHeading}>RENTAL PERIOD</Text>
        <View style={styles.infoTable}>
          <InfoRow label="START DATE" value={formatDate(data.pickupDate)} />
          <InfoRow label="END DATE" value={formatDate(data.returnDate)} last />
        </View>

        {/* ---- RENTAL FEES ---- */}
        <Text style={styles.sectionHeading}>RENTAL FEES</Text>
        <View style={styles.feesGrid}>
          <Text style={styles.feeItem}>
            <Text style={styles.feeLabel}>FEES: </Text>
            TT${data.dailyRate.toFixed(2)} per day
          </Text>
          <Text style={styles.feeItem}>
            <Text style={styles.feeLabel}>FUEL: </Text>
            {formatFuelLevel(data.fuelLevelAtPickup) || "To be recorded at pickup"} —
            renter is required to return the vehicle with the same fuel level
            received
          </Text>
          <Text style={styles.feeItem}>
            <Text style={styles.feeLabel}>PAID: </Text>
            TT${data.amountPaid.toFixed(2)} — rental paid in full online
          </Text>
          <Text style={styles.feeItem}>
            <Text style={styles.feeLabel}>LATE FEE: </Text>
            {data.lateReturnGraceHours}-hour grace period, then a flat TT$
            {data.lateFeeAmount.toFixed(2)}
          </Text>
        </View>
        <Text style={{ fontSize: 8, color: "#555555", marginBottom: 2 }}>
          Rental period: {data.rentalDays} day{data.rentalDays === 1 ? "" : "s"} ×
          TT${data.dailyRate.toFixed(2)} = TT${data.totalCost.toFixed(2)} total
        </Text>
        <Text style={{ fontSize: 8, color: "#555555" }}>
          Payment reference: {data.transactionRef}
        </Text>

        {/* ---- DRIVER ---- */}
        <Text style={styles.clauseHeading}>DRIVER</Text>
        <Text style={styles.clauseText}>
          The driver must be at the age of 25 years or older and must be the
          holder of a valid license under the Republic of Trinidad and Tobago
          for a minimum of 2 years.
        </Text>

        {/* ---- INDEMNIFICATION ---- */}
        <Text style={styles.clauseHeading}>INDEMNIFICATION</Text>
        <Text style={styles.clauseText}>
          Renter agrees to indemnify, defend and hold harmless the Owner for
          any loss, damage, or legal actions against Owner as a result of
          Renter&apos;s operation or use of the Rented Vehicle during the term
          of this Car Rental Agreement. This includes any attorney fees
          necessarily incurred for these purposes. Renter will also pay for
          any parking tickets, moving violations, or other citations received
          while in possession of the said vehicle.
        </Text>

        {/* ---- VEHICLE USE ---- */}
        <Text style={styles.clauseHeading}>VEHICLE USE</Text>
        <Text style={styles.clauseText}>
          Renter must only use the vehicle on properly formed roadways — no
          gravel roads, stone roads, sand roads, etc. Renter must at no time
          abandon the vehicle nor park or leave the vehicle unattended while
          unlocked. Renter shall not drive while under the influence of
          alcohol or any uncontrolled substance. Renter should not use the
          vehicle for any illegal activities or transportation. It is
          strictly forbidden for the renter to overload or exceed seating
          accommodation, transform the vehicle, modify its technical
          features, or add or remove any parts or accessories.
        </Text>

        {/* ---- CANCELLATION POLICY ----
             Not present on the original paper form, which was written for
             in-person cash transactions where cancellation was settled by
             conversation. Online prepayment makes a written policy necessary:
             the customer has already paid by the time they might need to
             cancel, so the terms must be stated. ---- */}
        <Text style={styles.clauseHeading}>CANCELLATION POLICY</Text>
        <Text style={styles.clauseText}>{data.cancellationPolicyNote}</Text>

        {/* ---- RENTAL COMPENSATION ---- */}
        <Text style={styles.clauseHeading}>RENTAL COMPENSATION</Text>
        <Text style={styles.clauseText}>
          Renter will return the vehicle in the same condition as received.
          If the vehicle is damaged, Renter must repay the vehicle owner the
          full price to repair it to the same standard condition. In the
          event the vehicle is written off, Renter must repay the owner the
          full cost.
        </Text>

        {/* ---- BREAKDOWN / ACCIDENT / DAMAGE / LOSS / THEFT ---- */}
        <Text style={styles.clauseHeading}>
          RENTAL OBLIGATION IN CASE OF BREAKDOWN, FAULT, ACCIDENT, DAMAGE,
          LOSS OR THEFT CAUSED TO THE VEHICLE
        </Text>
        <Text style={styles.clauseText}>
          Renter must immediately inform the owner of any breakdown, defect,
          or fault in the vehicle and must not use the vehicle in unworthy
          road conditions. In case of neglect, tampering, loss, or accident,
          the renter promises to take any and all steps or measures necessary
          to protect the Owner&apos;s interest. Any type of accident, theft,
          or incident involving the vehicle must be reported to the owner
          and the nearest Police Station immediately.
        </Text>

        {/* ---- AMOUNT PAID ---- */}
        <View style={styles.amountPaidRow}>
          <Text style={styles.amountPaidLabel}>AMOUNT PAID:</Text>
          <Text style={styles.amountPaidValue}>
            TT${data.amountPaid.toFixed(2)} — rental paid in full
          </Text>
        </View>

        {/* ---- Signatures — all three kept, matching the physical form,
             so a printed copy of this PDF is usable for in-person
             countersigning at pickup exactly like the paper original ---- */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>RENTER SIGNED</Text>
            <View style={styles.signatureRule} />
          </View>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>OWNER SIGNED</Text>
            <View style={styles.signatureRule} />
          </View>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>WITNESS SIGNED</Text>
            <View style={styles.signatureRule} />
          </View>
        </View>

        <Text style={styles.footer}>
          {data.businessName} · {data.businessAddress} · {data.businessPhone}
          {"\n"}
          Generated electronically for booking {data.bookingRef}. Mileage and
          fuel level are recorded by staff at vehicle pickup.
        </Text>
      </Page>
    </Document>
  );
}

/** Renders the rental agreement to a PDF buffer for upload to Supabase Storage. */
export async function generateRentalAgreementPdf(
  data: RentalAgreementData
): Promise<Buffer> {
  return renderToBuffer(<RentalAgreementDocument data={data} />);
}
