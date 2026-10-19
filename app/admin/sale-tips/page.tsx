import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { AdminStatStrip } from "@/components/features/admin/admin-stat-strip"
import { SaleTipsAdminTable } from "@/components/features/admin/sale-tips-admin-table"
import { formatAdminUsd } from "@/lib/admin/admin-user-detail-display"
import { listAdminSaleTipsService } from "@/lib/services/adminSaleTips"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Seller tips — Admin — Reswell",
  description: "Tips sellers paid to Reswell after marking a listing sold.",
  path: "/admin/sale-tips",
})

export default async function AdminSaleTipsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[]
    q?: string | string[]
    seller?: string | string[]
    page?: string | string[]
  }>
}) {
  const params = await searchParams
  const result = await listAdminSaleTipsService(params)
  const summary = "success" in result ? result.data.summary : null

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Seller tips"
        description="Payments sellers sent to Reswell when they marked a board sold off-platform. Totals below are all-time and ignore the table filters."
        breadcrumbs={[
          { label: "Home", href: "/admin/home" },
          { label: "Seller tips" },
        ]}
      />
      {"error" in result ? <p className="text-sm text-destructive">{result.error}</p> : null}
      {summary ? (
        <AdminStatStrip
          items={[
            {
              label: "Paid tips",
              value: formatAdminUsd(summary.succeededAmountCents / 100),
              footnote: `${summary.succeededCount} payment${summary.succeededCount === 1 ? "" : "s"}`,
              tone: "green",
            },
            {
              label: "Sellers who tipped",
              value: String(summary.uniqueSucceededSellers),
              footnote: "Distinct users with a paid tip",
              tone: "teal",
            },
            {
              label: "Pending",
              value: String(summary.pendingCount),
              footnote: "Checkout started, not paid",
              tone: "amber",
            },
            {
              label: "Failed or canceled",
              value: String(summary.failedCount + summary.canceledCount),
              footnote: `${summary.failedCount} failed · ${summary.canceledCount} canceled`,
              tone: "red",
            },
          ]}
        />
      ) : null}
      {"success" in result ? <SaleTipsAdminTable directory={result.data} /> : null}
    </div>
  )
}
