import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { StripeBooksDashboard } from "@/components/features/admin/stripe-books-dashboard"
import { loadStripeBooksReport } from "@/lib/services/stripeBooks"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const metadata = privatePageMetadata({
  title: "Stripe books — Admin — Reswell",
  description: "Reconcile Stripe charges, fees, Connect transfers, payouts, and wallet ledgers.",
  path: "/admin/stripe-books",
})

export default async function AdminStripeBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; range?: string | string[] }>
}) {
  const params = await searchParams
  const result = await loadStripeBooksReport(params)

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Stripe books"
          description="Reconcile Stripe charges, fees, Connect transfers, payouts, and wallet ledgers."
          breadcrumbs={[
            { label: "Home", href: "/admin/home" },
            { label: "Stripe books" },
          ]}
        />
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    )
  }

  return <StripeBooksDashboard report={result.data} />
}
