import { logSellFunnelEventAction } from "@/lib/actions/sellFunnelActions"
import type { SellFunnelEventInput } from "@/lib/validations/sell-funnel-event"

/**
 * Fire-and-forget sell funnel logging for client components. Never throws and
 * never blocks the UI; failures are only surfaced in development.
 */
export function logSellFunnelEvent(event: SellFunnelEventInput): void {
  void logSellFunnelEventAction(event)
    .then((res) => {
      if ("error" in res && process.env.NODE_ENV === "development") {
        console.warn("[sell] funnel event not recorded:", res.error, event)
      }
    })
    .catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[sell] funnel event failed:", err)
      }
    })
}
