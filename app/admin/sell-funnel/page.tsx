import { privatePageMetadata } from "@/lib/site-metadata"
import { SellFunnelAdminClient } from "@/components/features/admin/sell-funnel-admin-client"

export const metadata = privatePageMetadata({
  title: "Sell funnel — Reswell admin",
  description:
    "Publish funnel drop-off, validation failures, step completion, and recent /sell instrumentation events.",
  path: "/admin/sell-funnel",
})

export default function AdminSellFunnelPage() {
  return (
    <>
      <h1 className="sr-only">Sell funnel analytics</h1>
      <SellFunnelAdminClient />
    </>
  )
}
