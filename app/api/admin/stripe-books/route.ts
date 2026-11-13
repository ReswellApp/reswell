import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { loadStripeBooksCsv, loadStripeBooksReport } from "@/lib/services/stripeBooks"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { searchParams } = request.nextUrl
  const query = {
    month: searchParams.get("month") ?? undefined,
    range: searchParams.get("range") ?? undefined,
  }
  const format = searchParams.get("format")

  if (format === "csv") {
    const csv = await loadStripeBooksCsv(query)
    if (!csv.ok) {
      return NextResponse.json({ error: csv.error }, { status: csv.status })
    }
    return new NextResponse(csv.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csv.filename}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const result = await loadStripeBooksReport(query)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data }, { status: 200 })
}
