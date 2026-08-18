import {
  SELL_ENTRY_POINTS,
  type SellEntryPoint,
} from "@/lib/validations/sell-funnel-event"

const SESSION_KEY = "reswell.sell.entryPoint"

function isSellEntryPoint(value: string): value is SellEntryPoint {
  return (SELL_ENTRY_POINTS as readonly string[]).includes(value)
}

/**
 * Force the session entry point (catalog handoff, celebration, mode toggle).
 * Call before navigation so the destination flow_started stamps correctly.
 */
export function setSellEntryPoint(entry: SellEntryPoint): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(SESSION_KEY, entry)
  } catch {
    /* private mode */
  }
}

/** Read the stamped entry point for this tab session, if any. */
export function peekSellEntryPoint(): SellEntryPoint | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw && isSellEntryPoint(raw)) return raw
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Resolve (and persist once) how the seller entered /sell this session.
 * First write wins — later navigations within the funnel keep the original.
 */
export function resolveSellEntryPoint(hint?: SellEntryPoint | null): SellEntryPoint {
  if (typeof window === "undefined") return hint ?? "unknown"

  const existing = peekSellEntryPoint()
  if (existing) return existing

  let resolved: SellEntryPoint = hint ?? "unknown"

  if (!hint) {
    try {
      const params = new URLSearchParams(window.location.search)
      const from = params.get("from")?.trim()
      if (from === "nav" || from === "header") {
        resolved = "header_cta"
      } else if (from === "giveaway") {
        resolved = "giveaway"
      } else if (params.get("new") === "1") {
        resolved = "new_param"
      } else {
        const path = window.location.pathname
        if (path === "/sell/boards" || path.startsWith("/sell/boards/")) {
          resolved = "direct_boards"
        } else if (path === "/sell") {
          resolved = "bare_sell"
        }
      }
    } catch {
      resolved = "unknown"
    }
  }

  setSellEntryPoint(resolved)
  return resolved
}
