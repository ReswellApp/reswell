/** Inbox list at `/messages` (not a thread, offers tab, or compose). */
export function isMessagesInboxIndexRoute(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.replace(/\/$/, "") === "/messages"
}

/** Desktop split-view shell (`/messages`, counterparty hub) — not offers or thread detail. */
export function isMessagesDesktopShellRoute(pathname: string | null): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/$/, "") || "/"
  if (!normalized.startsWith("/messages")) return false
  if (normalized === "/messages/offers") return false
  if (isMessageThreadDetailRoute(normalized)) return false
  return true
}

/** Single conversation thread or new-message compose (mobile dock + scroll targets). */
export function isMessageThreadDetailRoute(pathname: string | null): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/$/, "") || "/"
  if (normalized === "/messages/offers") return false
  if (normalized === "/messages/new") return true
  return /^\/messages\/[^/]+$/.test(normalized)
}

export function isMobileMessageThreadViewport(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(max-width: 1023px)").matches
}

let scrollBottomGeneration = 0

/** Invalidate pending delayed scroll-to-bottom callbacks (e.g. after route change). */
export function cancelMessageThreadScrollBottom(): void {
  scrollBottomGeneration += 1
}

/**
 * Scroll the document to the bottom on mobile thread routes.
 * Returns a cleanup that cancels delayed retries — required on unmount/route change.
 */
export function scrollPageToMessageThreadBottom(): () => void {
  if (typeof window === "undefined") return () => {}
  if (!isMobileMessageThreadViewport()) return () => {}

  const generation = ++scrollBottomGeneration

  const scroll = () => {
    if (generation !== scrollBottomGeneration) return
    if (!isMobileMessageThreadViewport()) return
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      left: 0,
      behavior: "instant",
    })
  }

  scroll()
  const raf = requestAnimationFrame(scroll)
  const t0 = window.setTimeout(scroll, 0)
  const t120 = window.setTimeout(scroll, 120)

  return () => {
    if (generation === scrollBottomGeneration) {
      scrollBottomGeneration += 1
    }
    cancelAnimationFrame(raf)
    window.clearTimeout(t0)
    window.clearTimeout(t120)
  }
}
