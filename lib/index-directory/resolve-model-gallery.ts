import type { BoardModel, BoardModelDetail, BoardModelGalleryImage } from "@/lib/index-directory/types"

/** Same gallery resolution as the model page: prefer detail.galleryImages, else fall back to listing image + marketing art. */
export function resolveModelGallery(model: BoardModel, detail: BoardModelDetail | null): BoardModelGalleryImage[] {
  if (detail?.galleryImages?.length) {
    return detail.galleryImages
  }
  const out: BoardModelGalleryImage[] = [{ url: model.imageUrl, caption: "Board" }]
  if (detail?.marketingImageUrl) {
    out.push({ url: detail.marketingImageUrl, caption: "Model art" })
  }
  return out
}
