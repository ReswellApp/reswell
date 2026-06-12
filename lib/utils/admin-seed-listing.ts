/** Internal admin QA listings — never show on public marketplace surfaces. */
export function isAdminSeedListingTitle(title: string | null | undefined): boolean {
  if (typeof title !== "string") return false
  return /^admin seed/i.test(title.trim())
}
