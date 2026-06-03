/** Scroll the window to the top (matches {@link NavigationPageGate} on route change). */
export function scrollPageToTop(): void {
  if (typeof window === "undefined") return
  window.scrollTo({ top: 0, left: 0, behavior: "instant" })
}
