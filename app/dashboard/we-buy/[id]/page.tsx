import { redirect } from "next/navigation"
import { boardBuyQuotePath } from "@/lib/board-buy/quote-href"

export default async function DashboardWeBuyDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(boardBuyQuotePath(id))
}
