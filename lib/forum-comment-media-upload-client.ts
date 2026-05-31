import {
  FORUM_ATTACHMENTS_BUCKET,
  type ForumCommentImageAttachment,
} from "@/lib/validations/forum-comment-attachment"
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

export type UploadedForumCommentImageAttachment = {
  attachment: Omit<ForumCommentImageAttachment, "bucket">
}

export async function uploadForumCommentMediaFile(opts: {
  file: File
  threadId: string
  supabaseUrl: string
  accessToken: string
  anonKey: string
  onProgress?: (loaded: number, total: number) => void
}): Promise<UploadedForumCommentImageAttachment> {
  const { file, threadId, supabaseUrl, accessToken, anonKey, onProgress } = opts

  if (!file.type.startsWith("image/")) {
    throw new Error("Only photos are supported in Board Talk comments.")
  }

  assertMessageImageOriginalSize(file)
  const source = await ensureBrowserDecodableImageFile(file)
  const prepared = await prepareMessageImageFromFile(source)
  const objectId = crypto.randomUUID()
  const pathInBucket = `${threadId}/${objectId}.${prepared.ext}`
  const safeName = displayFileName(file.name, prepared.ext)

  await uploadStorageObjectWithProgress({
    supabaseUrl,
    accessToken,
    anonKey,
    bucket: FORUM_ATTACHMENTS_BUCKET,
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
