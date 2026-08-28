import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { DashboardBoardBuyDetail } from "@/components/features/board-buy/dashboard-board-buy-detail"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { getMyBoardBuyService } from "@/lib/services/boardBuy"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Buy-program quote — Dashboard",
  description: "Your Reswell offer and shipping label.",
  path: "/dashboard/we-buy",
})

export default async function DashboardWeBuyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/we-buy")
  }
  const { id } = await params
  const result = await getMyBoardBuyService(id)
  if ("error" in result) {
    if (result.error === "Not found") notFound()
    return <p className="text-sm text-destructive">{result.error}</p>
  }

  return (
    <div className="space-y-4">
      <Link href="/dashboard/we-buy" className="text-sm underline">
        All quotes
      </Link>
      <DashboardBoardBuyDetail submission={result.data} />
    </div>
  )
}
