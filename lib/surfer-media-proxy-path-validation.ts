const OBJECT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates object keys for `/media/surfers/...` (`surfer-assets` bucket uploads).
 */
export function isValidSurferAssetsObjectPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean)
  if (segments.length !== 2) return false
  if (segments.some((s) => s.includes(".."))) return false
  const [folder, file] = segments
  if (folder !== "photos" && folder !== "quiver") return false
  if (!OBJECT_UUID_RE.test(file.replace(/\.webp$/i, ""))) return false
  if (!/^[\da-f-]+\.webp$/i.test(file)) return false
  return true
}
