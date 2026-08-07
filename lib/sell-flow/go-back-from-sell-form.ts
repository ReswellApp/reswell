/**
 * In-app Back for sell forms. Prefer browser history so sellers return to
 * wherever they actually came from — never the Quick vs Full path picker.
 */
export function goBackFromSellForm(
  router: { back: () => void; push: (href: string) => void },
  fallbackHref = "/sell",
): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back()
    return
  }
  router.push(fallbackHref)
}
