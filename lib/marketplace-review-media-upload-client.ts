import {
  MARKETPLACE_REVIEW_ATTACHMENTS_BUCKET,
  type MarketplaceReviewAttachmentInput,
} from "@/lib/validations/marketplace-review-attachment"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import {
  assertMessageImageOriginalSize,
  prepareMessageImageFromFile,
} from "@/lib/message-media-pipeline"
import { uploadStorageObjectWithProgress } from "@/lib/supabase/storage-upload-xhr"

function displayFileName(raw: string, fallbackExt: string): string {
  const base = raw.replace(/^.*[/\\]/, "").trim() || `photo.${fallbackExt}`
  return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200)
}

export async function uploadMarketplaceReviewMediaFile(opts: {
  file: File
  reviewerId: string
  supabaseUrl: string
  accessToken: string
  anonKey: string
  onProgress?: (loaded: number, total: number) => void
}): Promise<{ attachment: MarketplaceReviewAttachmentInput }> {
  const { file, reviewerId, supabaseUrl, accessToken, anonKey, onProgress } = opts

  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
    throw new Error("Only photos are supported in reviews.")
  }

  assertMessageImageOriginalSize(file)
  const source = await ensureBrowserDecodableImageFile(file)
  const prepared = await prepareMessageImageFromFile(source)
  const objectId = crypto.randomUUID()
  const pathInBucket = `${reviewerId}/${objectId}.${prepared.ext}`
  const safeName = displayFileName(file.name, prepared.ext)

  await uploadStorageObjectWithProgress({
    supabaseUrl,
    accessToken,
    anonKey,
    bucket: MARKETPLACE_REVIEW_ATTACHMENTS_BUCKET,
    pathInBucket,
    body: prepared.blob,
    contentType: prepared.contentType,
    upsert: false,
    onProgress: onProgress ? (p) => onProgress(p.loaded, p.total) : undefined,
  })

  return {
    attachment: {
      kind: "image",
      path: pathInBucket,
      file_name: safeName,
      mime_type: prepared.contentType,
      size_bytes: prepared.blob.size,
      width: prepared.width,
      height: prepared.height,
    },
  }
}
