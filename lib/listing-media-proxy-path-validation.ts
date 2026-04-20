/**
 * Validates object keys for the listing media proxy (defense-in-depth; must match
 * upload naming from {@link uploadListingImagePairToSupabase}).
 */
export function isValidListingMediaObjectPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean)
  if (segments.length !== 2) return false
  if (segments.some((s) => s.includes(".."))) return false
  const [userId, file] = segments
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return false
  if (!/^[a-zA-Z0-9._-]+\.(webp|jpe?g)$/i.test(file)) return false
  return true
}
