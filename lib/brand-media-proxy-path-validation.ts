/**
 * Validates object keys for `/media/brands/...` (`brand-assets` bucket uploads).
 */
export function isValidBrandAssetsObjectPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean)
  if (segments.length < 2 || segments.length > 3) return false
  if (segments.some((s) => s.includes(".."))) return false

  const file = segments[segments.length - 1] ?? ""
  if (!/^[a-zA-Z0-9._-]+\.(webp|jpe?g|png|gif|svg)$/i.test(file)) return false

  if (segments.length === 2) {
    const folder = segments[0] ?? ""
    return folder === "logos" || folder === "board-models"
  }

  return segments[0] === "board-models" && segments[1] === "dimensions"
}
