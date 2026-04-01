import Link from "next/link"
import { Package } from "lucide-react"

/** Full-width callout on listing detail when status is sold — desktop and mobile. */
export function ListingSoldDetailNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm ${className ?? ""}`}
    >
      <div className="flex gap-3">
        <div
          className="flex h-8 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wide text-white"
          style={{ backgroundColor: "#111" }}
        >
          Sold
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-foreground">This item has sold on Reswell</p>
          <p className="text-muted-foreground leading-snug">
            It’s no longer available to buy, and offers aren’t accepted. You can still browse photos and
            details for reference.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Owner-only copy when the listing is sold — no edit / end actions. */
export function ListingSoldOwnerNotice({
  dashboardListingsHref,
  sectionLabel,
}: {
  dashboardListingsHref: string
  sectionLabel: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Package className="h-5 w-5" />
      </div>
      <p className="font-medium text-foreground">This {sectionLabel} sold on Reswell</p>
      <p className="mt-2 text-sm text-muted-foreground leading-snug">
        This page stays visible for your records. Buyers can’t purchase it or send offers. Editing and
        “end listing” are disabled for sold listings.
      </p>
      <Link
        href={dashboardListingsHref}
        className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        View your listings in the dashboard
      </Link>
    </div>
  )
}
