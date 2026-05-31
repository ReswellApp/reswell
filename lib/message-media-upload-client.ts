import {
  MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
  type MarketplaceMessageImageAttachment,
  type MarketplaceMessageVideoAttachment,
} from "@/lib/validations/marketplace-message-attachment"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import {
  assertMessageImageOriginalSize,
  assertMessageVideoOriginalSize,
  isMessageVideoFile,
  messageVideoExtensionForMime,
  normalizeMessageVideoMimeType,
  prepareMessageImageFromFile,
} from "@/lib/message-media-pipeline"
import { uploadStorageObjectWithProgress } from "@/lib/supabase/storage-upload-xhr"

function displayFileName(raw: string, fallbackExt: string): string {
  const base = raw.replace(/^.*[/\\]/, "").trim() || `attachment.${fallbackExt}`
  return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200)
}

export type UploadedMessageImageAttachment = {
  kind: "image"
  attachment: Omit<MarketplaceMessageImageAttachment, "bucket">
}

export type UploadedMessageVideoAttachment = {
  kind: "video"
  attachment: Omit<MarketplaceMessageVideoAttachment, "bucket">
}

export async function uploadMessageMediaFile(opts: {
  file: File
  conversationId: string
  supabaseUrl: string
  accessToken: string
  anonKey: string
  onProgress?: (loaded: number, total: number) => void
}): Promise<UploadedMessageImageAttachment | UploadedMessageVideoAttachment> {
  const { file, conversationId, supabaseUrl, accessToken, anonKey, onProgress } = opts

  if (isMessageVideoFile(file)) {
    assertMessageVideoOriginalSize(file)
    const mimeType = normalizeMessageVideoMimeType(file)
    const ext = messageVideoExtensionForMime(mimeType)
    const objectId = crypto.randomUUID()
    const pathInBucket = `${conversationId}/${objectId}.${ext}`
    const safeName = displayFileName(file.name, ext)

    await uploadStorageObjectWithProgress({
      supabaseUrl,
      accessToken,
      anonKey,
      bucket: MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
      pathInBucket,
      body: file,
      contentType: mimeType,
      upsert: false,
      onProgress: onProgress ? (p) => onProgress(p.loaded, p.total) : undefined,
    })

    return {
      kind: "video",
      attachment: {
        kind: "video",
        path: pathInBucket,
        file_name: safeName,
        mime_type: mimeType,
        size_bytes: file.size,
      },
    }
  }

  assertMessageImageOriginalSize(file)
  const source = await ensureBrowserDecodableImageFile(file)
  const prepared = await prepareMessageImageFromFile(source)
  const objectId = crypto.randomUUID()
  const pathInBucket = `${conversationId}/${objectId}.${prepared.ext}`
  const safeName = displayFileName(file.name, prepared.ext)

  await uploadStorageObjectWithProgress({
    supabaseUrl,
    accessToken,
    anonKey,
    bucket: MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
    pathInBucket,
    body: prepared.blob,
    contentType: prepared.contentType,
    upsert: false,
    onProgress: onProgress ? (p) => onProgress(p.loaded, p.total) : undefined,
  })

  return {
    kind: "image",
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
