import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";
import { computeReports } from "@/lib/reports";
import { generateReportPdf } from "@/lib/report-pdf";

// A6 Reports — PDF export. Owner-only, matching the Reports page itself
// (financial data, excluded from Staff Agent access per the SS1 role
// definition — the same restriction enforced here as on the page route,
// since this endpoint would otherwise be a way around that restriction).
export async function GET(request: NextRequest) {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const data = await computeReports(from, to);
  const pdfBuffer = await generateReportPdf({ data, from, to, generatedAt: new Date() });

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tigers-car-rental-report.pdf"`,
    },
  });
}
