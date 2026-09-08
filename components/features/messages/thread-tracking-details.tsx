"use client"

import { Copy, Truck } from "lucide-react"
import { toast } from "sonner"
import { formatCarrierServiceDisplay } from "@/lib/shipping/resolve-carrier-code"
import { cn } from "@/lib/utils"

export function ThreadTrackingDetails({
  trackingNumber,
  trackingCarrier,
}: {
  trackingNumber: string | null
  trackingCarrier: string | null
}) {
  const carrier = formatCarrierServiceDisplay(trackingCarrier)
  if (!trackingNumber && !carrier) return null

  async function copyTracking() {
    if (!trackingNumber) return
    try {
      await navigator.clipboard.writeText(trackingNumber)
      toast.success("Tracking number copied")
    } catch {
      toast.error("Couldn’t copy tracking number")
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-muted/45 px-3 py-2.5 text-[14px] leading-snug text-foreground/90">
      {trackingNumber ? (
        <div className="flex items-start gap-2">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tracking
            </p>
            <button
              type="button"
              onClick={() => void copyTracking()}
              className="mt-0.5 flex max-w-full items-center gap-1.5 text-left font-medium tabular-nums text-foreground"
            >
              <span className="min-w-0 break-all">{trackingNumber}</span>
              <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Copy tracking number</span>
            </button>
          </div>
        </div>
      ) : null}
      {carrier ? (
        <p className={cn(!trackingNumber && "flex items-center gap-2")}>
          {!trackingNumber ? (
            <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : null}
          <span>
            <span className="text-muted-foreground">Carrier </span>
            <span className="font-medium text-foreground">{carrier}</span>
          </span>
        </p>
      ) : null}
    </div>
  )
}
