/**
 * Validates paths for `/media/blog/...`; must match uploads in `@/lib/blog/upload-blog-media`.
 */
export function isValidBlogImagesObjectPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean)
  if (segments.length !== 2) return false
  if (segments.some((s) => s.includes(".."))) return false
  const [folder, file] = segments
  if (folder !== "cms") return false
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,10}$/i.test(
      file,
    )
  ) {
    return false
  }
  if (!/\.(jpe?g|png|webp|gif)$/i.test(file)) return false
  return true
}
