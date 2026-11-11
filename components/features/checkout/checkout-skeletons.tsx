import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const SHIPPING_RATE_ROWS = [
  { nameWidth: "w-36", metaWidth: "w-28", priceWidth: "w-12" },
  { nameWidth: "w-44", metaWidth: "w-32", priceWidth: "w-14" },
  { nameWidth: "w-40", metaWidth: "w-24", priceWidth: "w-12" },
] as const

/** Mimics peer checkout carrier rate radio options while ShipEngine quotes. */
export function CheckoutShippingRatesSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-[8px] border border-neutral-200 bg-white px-4 py-4",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Getting live carrier rates for your address</span>
      <Skeleton className="h-3.5 w-[min(100%,18rem)]" />
      <div className="space-y-2">
        {SHIPPING_RATE_ROWS.map((row) => (
          <div
            key={row.nameWidth}
            className="flex items-start gap-3 rounded-[8px] border border-neutral-200 px-3.5 py-3"
          >
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cn("h-3.5", row.nameWidth)} />
              <Skeleton className={cn("h-3", row.metaWidth)} />
            </div>
            <Skeleton className={cn("mt-0.5 h-3.5 shrink-0", row.priceWidth)} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mimics Express Checkout + Payment Element + Pay button while Stripe mounts. */
export function CheckoutPaymentFormSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn("flex min-h-[320px] flex-col space-y-4", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading secure checkout</span>
      <div className="space-y-2">
        <Skeleton className="h-11 w-full rounded-md" />
        <div className="flex items-center gap-3 py-1">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-px flex-1" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-auto h-11 w-full rounded-md" />
    </div>
  )
}
