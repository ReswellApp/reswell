export type SellFlowListingKind = "board" | "fins"

/** While set, IndexedDB restore must not run — coordinates with draft clear after `?new=1`. */
export const SELL_SUPPRESS_IDB_RESTORE_KEY = "reswell.sell.suppressIdbRestoreOnce"

/** Set when Publish is tapped while signed out — resume submit after sign-in. */
export function sellPendingPublishKey(kind: SellFlowListingKind): string {
  return kind === "fins" ? "reswell.sell.fins.pendingPublishOnce" : "reswell.sell.pendingPublishOnce"
}

export function sellFlowStepSessionKey(kind: SellFlowListingKind): string | null {
  if (kind === "fins") return "reswell.sell.fins.flowStep"
  if (kind === "board") return "reswell.sell.board.flowStep"
  return null
}

export function markPendingPublish(kind: SellFlowListingKind): void {
  try {
    sessionStorage.setItem(sellPendingPublishKey(kind), "1")
  } catch {
    /* quota / private mode */
  }
}

export function clearPendingPublish(kind: SellFlowListingKind): void {
  try {
    sessionStorage.removeItem(sellPendingPublishKey(kind))
  } catch {
    /* ignore */
  }
}

export function isPendingPublish(kind: SellFlowListingKind): boolean {
  try {
    return sessionStorage.getItem(sellPendingPublishKey(kind)) === "1"
  } catch {
    return false
  }
}
