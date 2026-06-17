/** Single conversation thread or new-message compose (mobile dock + scroll targets). */
export function isMessageThreadDetailRoute(pathname: string | null): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/$/, "") || "/"
  if (normalized === "/messages/new") return true
  return /^\/messages\/[^/]+$/.test(normalized) && normalized !== "/messages/offers"
}

export function scrollPageToMessageThreadBottom(): void {
  if (typeof window === "undefined") return

  const scroll = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      left: 0,
      behavior: "instant",
    })
  }

  scroll()
  requestAnimationFrame(scroll)
  window.setTimeout(scroll, 0)
  window.setTimeout(scroll, 120)
}
