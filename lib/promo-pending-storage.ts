const PENDING_PROMO_STORAGE_KEY = "reswell.pending_promo_code"

/** Persist a promo code from cart so checkout can auto-apply it. */
export function setPendingPromoCode(code: string): void {
  if (typeof window === "undefined") return
  const trimmed = code.trim()
  if (!trimmed) return
  try {
    sessionStorage.setItem(PENDING_PROMO_STORAGE_KEY, trimmed)
  } catch {
    // ignore quota / private mode
  }
}

export function getPendingPromoCode(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PENDING_PROMO_STORAGE_KEY)
    const trimmed = raw?.trim() || ""
    return trimmed || null
  } catch {
    return null
  }
}

export function clearPendingPromoCode(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(PENDING_PROMO_STORAGE_KEY)
  } catch {
    // ignore
  }
}
