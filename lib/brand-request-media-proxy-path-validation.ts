const PROFILE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates object keys for `/media/brand-requests/...` (`brand-request-logos` bucket).
 */
export function isValidBrandRequestLogosObjectPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean)
  if (segments.length !== 2) return false
  if (segments.some((s) => s.includes(".."))) return false
  const [userId, file] = segments
  if (!PROFILE_UUID_RE.test(userId)) return false
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,10}$/i.test(file)) {
    return false
  }
  if (!/\.(jpe?g|png|webp|gif)$/i.test(file)) return false
  return true
}
