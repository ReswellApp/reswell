/** URL-safe slug for brand routes: lowercase letters, numbers, single hyphens. */
export function slugifyBrandName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
  return s.length > 0 ? s : "brand"
}

export function isValidBrandSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 128
}
