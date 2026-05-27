import {
  BOARD_REVIEW_ATTACHMENTS_BUCKET,
  type BoardReviewImageAttachment,
} from "@/lib/validations/board-review-attachment"
import {
  assertMessageImageOriginalSize,
  browserCanDecodeImage,
  prepareMessageImageFromFile,
} from "@/lib/message-media-pipeline"
import { uploadStorageObjectWithProgress } from "@/lib/supabase/storage-upload-xhr"

function displayFileName(raw: string, fallbackExt: string): string {
  const base = raw.replace(/^.*[/\\]/, "").trim() || `photo.${fallbackExt}`
  return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200)
}

async function convertViaServer(file: File): Promise<File> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/api/convert-image", { method: "POST", body: form })
  const ct = res.headers.get("content-type") || ""
  if (!res.ok) {
    let msg = "Server could not convert this image to JPEG"
    try {
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { error?: string }
        if (j?.error) msg = j.error
      } else {
        const t = await res.text()
        if (t) msg = t.slice(0, 240)
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (!ct.includes("image/jpeg")) {
    throw new Error("Server did not return a JPEG image")
  }
  const blob = await res.blob()
  const base = file.name.replace(/\.[^.]+$/i, "") || "image"
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
}

async function toJpegIfUnsupported(file: File): Promise<File> {
  assertMessageImageOriginalSize(file)
  if (await browserCanDecodeImage(file)) return file
  return convertViaServer(file)
}

export type UploadedBoardReviewImageAttachment = {
  attachment: Omit<BoardReviewImageAttachment, "bucket">
}

export async function uploadBoardReviewMediaFile(opts: {
  file: File
  reviewerId: string
  supabaseUrl: string
  accessToken: string
  anonKey: string
  onProgress?: (loaded: number, total: number) => void
}): Promise<UploadedBoardReviewImageAttachment> {
  const { file, reviewerId, supabaseUrl, accessToken, anonKey, onProgress } = opts

  if (!file.type.startsWith("image/")) {
    throw new Error("Only photos are supported in board reviews.")
  }

  const source = await toJpegIfUnsupported(file)
  const prepared = await prepareMessageImageFromFile(source)
  const objectId = crypto.randomUUID()
  const pathInBucket = `${reviewerId}/${objectId}.${prepared.ext}`
  const safeName = displayFileName(file.name, prepared.ext)

  await uploadStorageObjectWithProgress({
    supabaseUrl,
    accessToken,
    anonKey,
    bucket: BOARD_REVIEW_ATTACHMENTS_BUCKET,
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
