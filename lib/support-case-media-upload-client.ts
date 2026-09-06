import {
  SUPPORT_CASE_ATTACHMENTS_BUCKET,
  type SupportCaseAttachmentInput,
} from "@/lib/validations/support-case-attachment"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import {
  assertMessageImageOriginalSize,
  prepareMessageImageFromFile,
} from "@/lib/message-media-pipeline"
import { uploadStorageObjectWithProgress } from "@/lib/supabase/storage-upload-xhr"
import type { SupportEvidenceKind } from "@/lib/types/protectionClaimDesk"

function displayFileName(raw: string, fallbackExt: string): string {
  const base = raw.replace(/^.*[/\\]/, "").trim() || `photo.${fallbackExt}`
  return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200)
}

export async function uploadSupportCaseEvidenceFile(opts: {
  file: File
  uploaderId: string
  supabaseUrl: string
  accessToken: string
  anonKey: string
  evidenceKind?: SupportEvidenceKind
  onProgress?: (loaded: number, total: number) => void
}): Promise<{ attachment: SupportCaseAttachmentInput }> {
  const { file, uploaderId, supabaseUrl, accessToken, anonKey, onProgress } = opts

  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
    throw new Error("Only photos are supported for claim evidence.")
  }

  assertMessageImageOriginalSize(file)
  const source = await ensureBrowserDecodableImageFile(file)
  const prepared = await prepareMessageImageFromFile(source)
  const objectId = crypto.randomUUID()
  const pathInBucket = `${uploaderId}/${objectId}.${prepared.ext}`
  const safeName = displayFileName(file.name, prepared.ext)

  await uploadStorageObjectWithProgress({
    supabaseUrl,
    accessToken,
    anonKey,
    bucket: SUPPORT_CASE_ATTACHMENTS_BUCKET,
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
      mime_type: prepared.contentType as SupportCaseAttachmentInput["mime_type"],
      size_bytes: prepared.blob.size,
      width: prepared.width,
      height: prepared.height,
      evidence_kind: opts.evidenceKind ?? "damage",
    },
  }
}
