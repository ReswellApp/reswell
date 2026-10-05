import Link from "next/link"
import { Package, Truck } from "lucide-react"
import { RelistListingButton } from "@/components/features/listings/relist-listing-button"

/** Full-width callout on listing detail when status is sold — desktop and mobile. */
export function ListingSoldDetailNotice({
  className,
  shipped = false,
}: {
  className?: string
  /** Listing offered shipping — shown as a simple shipped note on sold pages. */
  shipped?: boolean
}) {
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
          {shipped ? (
            <p className="inline-flex items-center gap-1.5 pt-0.5 text-[13px] leading-snug text-foreground/85">
              <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>This item was shipped</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Owner-only copy when the listing is sold. Off-platform marks can be relisted. */
export function ListingSoldOwnerNotice({
  dashboardListingsHref,
  sectionLabel,
  listingId,
  canRelist = false,
  className,
}: {
  dashboardListingsHref: string
  sectionLabel: string
  listingId: string
  canRelist?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${className ?? ""}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight text-foreground">
            This {sectionLabel} sold on Reswell
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {canRelist
              ? "This page stays visible for your records. If you marked it sold by accident, you can relist it."
              : "This page stays visible for your records. Buyers can’t purchase it or send offers. Editing and “end listing” are disabled for sold listings."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 pl-6 sm:pl-0">
        {canRelist ? (
          <RelistListingButton
            listingId={listingId}
            triggerSize="sm"
            triggerVariant="outline"
            triggerClassName="h-8 rounded-full px-3"
          />
        ) : null}
        <Link
          href={dashboardListingsHref}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          View your listings in the dashboard
        </Link>
      </div>
    </div>
  )
}
