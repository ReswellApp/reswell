import { privatePageMetadata } from "@/lib/site-metadata"
import { UsedBoardMarketDashboardClient } from "@/components/features/admin/used-board-market-dashboard-client"

export const metadata = privatePageMetadata({
  title: "Used surfboard market dashboard — Admin — Reswell",
  description:
    "Unified analytics view for the used surfboard market: inventory, supply, sales performance, pricing intelligence, and market overview.",
  path: "/admin/used-board-market-dashboard",
})

export default function AdminUsedBoardMarketDashboardPage() {
  return (
    <>
      <h1 className="sr-only">Used surfboard market dashboard</h1>
      <UsedBoardMarketDashboardClient />
    </>
  )
}
