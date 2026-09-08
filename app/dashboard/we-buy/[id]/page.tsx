import { redirect } from "next/navigation"
import { SELL_TO_RESWELL_ENABLED } from "@/lib/board-buy/constants"
import { boardBuyQuotePath } from "@/lib/board-buy/quote-href"

export default async function DashboardWeBuyDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!SELL_TO_RESWELL_ENABLED) {
    redirect("/dashboard")
  }

  const { id } = await params
  redirect(boardBuyQuotePath(id))
}
