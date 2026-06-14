import {
  NEWSLETTER_POPUP_STORAGE_KEY,
  type NewsletterPopupStorageState,
} from "@/lib/constants/newsletter-promo"

export function getNewsletterPopupStorageState(): NewsletterPopupStorageState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY)
    if (raw === "dismissed" || raw === "subscribed") return raw
    return null
  } catch {
    return null
  }
}

export function setNewsletterPopupStorageState(state: NewsletterPopupStorageState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(NEWSLETTER_POPUP_STORAGE_KEY, state)
  } catch {
    // ignore
  }
}

export function shouldShowNewsletterPopup(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith("/auth")) return false
  if (pathname.startsWith("/admin")) return false
  if (pathname.startsWith("/checkout")) return false
  if (pathname.startsWith("/sell")) return false
  if (pathname.startsWith("/messages")) return false
  return true
}
