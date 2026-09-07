import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { boardBuyStatusLabel } from "@/components/features/board-buy/board-buy-status-label"
import { boardBuyQuotePath, formatBoardBuyUsd } from "@/lib/board-buy/quote-href"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
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
          No quotes yet.{" "}
          <Link href="/we-buy" className="underline">
            We’ll buy your surfboard
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const thumb = row.photos[0]?.url
            return (
              <li key={row.id}>
                <Link
                  href={boardBuyQuotePath(row.id)}
                  className="flex gap-3 rounded-xl border bg-card p-3 transition hover:border-[#001A4A]/30 hover:bg-muted/30"
                >
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized={listingImageShouldBypassOptimization(thumb)}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#001A4A]">{row.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {boardBuyStatusLabel(row.status)} · Asking {formatBoardBuyUsd(row.askingPrice)}
                      {row.offeredPrice != null
                        ? ` · Offer ${formatBoardBuyUsd(row.offeredPrice)}`
                        : ""}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
