import Link from "next/link"
import { redirect } from "next/navigation"
import { boardBuyStatusLabel } from "@/components/features/board-buy/board-buy-status-label"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { listMyBoardBuysService } from "@/lib/services/boardBuy"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Sell to Reswell — Dashboard",
  description: "Your Reswell buy-program quotes and shipments.",
  path: "/dashboard/we-buy",
})

export default async function DashboardWeBuyPage() {
  const { user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/we-buy")
  }

  const result = await listMyBoardBuysService()
  const rows = "success" in result ? result.data : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-headline text-2xl font-bold">Sell to Reswell</h1>
        <Link href="/we-buy/submit" className="text-sm font-medium underline">
          New quote
        </Link>
      </div>
      {"error" in result ? <p className="text-sm text-destructive">{result.error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No submissions yet.{" "}
          <Link href="/we-buy" className="underline">
            We’ll buy your surfboard
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/dashboard/we-buy/${row.id}`} className="block px-4 py-3 hover:bg-muted/40">
                <p className="font-medium">{row.title}</p>
                <p className="text-sm text-muted-foreground">
                  {boardBuyStatusLabel(row.status)} · ${row.askingPrice.toFixed(2)}
                  {row.offeredPrice != null ? ` · offer $${row.offeredPrice.toFixed(2)}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
