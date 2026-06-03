const OBJECT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SHARE_IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i
const ICON_EXT_RE = /\.(png|svg|ico|webp|jpe?g|gif)$/i

/**
 * Validates object keys for `/media/seo/...` (`seo-assets` bucket uploads).
 */
export function isValidSeoAssetsObjectPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean)
  if (segments.length !== 2) return false
  if (segments.some((s) => s.includes(".."))) return false

  const [folder, file] = segments
  if (folder !== "share-images" && folder !== "icons") return false

  const idPart = file.replace(/\.[^.]+$/i, "")
  if (!OBJECT_UUID_RE.test(idPart)) return false

  if (folder === "share-images") return SHARE_IMAGE_EXT_RE.test(file)
  return ICON_EXT_RE.test(file)
}
