export function scrollSellSectionIntoView(sectionId: string): void {
  const el = document.getElementById(sectionId)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function scrollPublishValidationBannerIntoView(bannerId = "sell-publish-validation-banner"): void {
  window.requestAnimationFrame(() => {
    document.getElementById(bannerId)?.scrollIntoView({ behavior: "smooth", block: "center" })
  })
}
