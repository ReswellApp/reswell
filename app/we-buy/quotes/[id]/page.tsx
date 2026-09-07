import { notFound, redirect } from "next/navigation"
import { BoardBuyQuoteDocument } from "@/components/features/board-buy/board-buy-quote-document"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { boardBuyQuotePath } from "@/lib/board-buy/quote-href"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { getMyBoardBuyService } from "@/lib/services/boardBuy"
import { privatePageMetadata } from "@/lib/site-metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getMyBoardBuyService(id)
  const title =
    "success" in result ? `${result.data.title} — Reswell quote` : "Reswell quote"
  return privatePageMetadata({
    title,
    description: "Your Reswell buy-program quote, offer, and shipping label.",
    path: boardBuyQuotePath(id),
  })
}

export default async function WeBuyQuotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user } = await getCachedDashboardSession()
  const { id } = await params
  if (!user || isAnonymousSupabaseUser(user)) {
    redirect(`/auth/login?redirect=${encodeURIComponent(boardBuyQuotePath(id))}`)
  }

  const result = await getMyBoardBuyService(id)
  if ("error" in result) {
    if (result.error === "Not found" || result.error === "Sign in to continue.") {
      notFound()
    }
    return (
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12">
        <p className="text-sm text-destructive">{result.error}</p>
      </main>
    )
  }

  return (
    <main className="flex-1 bg-background px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      <BoardBuyQuoteDocument submission={result.data} />
    </main>
  )
}
