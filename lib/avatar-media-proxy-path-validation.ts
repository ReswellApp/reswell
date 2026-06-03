const PROFILE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates object keys for `/media/avatars/...` (avatars bucket uploads).
 */
export function isValidAvatarsObjectPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean)
  if (segments.length !== 2) return false
  if (segments.some((s) => s.includes(".."))) return false
  const [userId, file] = segments
  if (!PROFILE_UUID_RE.test(userId)) return false
  if (!/^[a-zA-Z0-9._-]+\.(webp|jpe?g|png|gif|svg)$/i.test(file)) return false
  return true
}
