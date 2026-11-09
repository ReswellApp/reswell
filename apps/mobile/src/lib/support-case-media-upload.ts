import type { MobileSupportMediaBody } from "@reswell/api-contract"
import { getSupabase } from "@/lib/supabase"

/** Same bucket as website claim / help evidence uploads. */
const SUPPORT_CASE_ATTACHMENTS_BUCKET = "support-case-attachments"

const MAX_IMAGE_BYTES = 20 * 1024 * 1024

function mimeForAsset(mimeType: string | null | undefined): MobileSupportMediaBody["attachment"]["mime_type"] {
  const mime = (mimeType ?? "image/jpeg").toLowerCase()
  if (mime === "image/png") return "image/png"
  if (mime === "image/webp") return "image/webp"
  if (mime === "image/gif") return "image/gif"
  return "image/jpeg"
}

function extensionForMime(mime: MobileSupportMediaBody["attachment"]["mime_type"]): string {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  return "jpg"
}

function safeFileName(raw: string | null | undefined, ext: string): string {
  const base = (raw ?? `photo.${ext}`).replace(/^.*[/\\]/, "").trim() || `photo.${ext}`
  return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200)
}

/** Upload a picked image into support-case-attachments (same bucket as the website). */
export async function uploadSupportCaseImageAttachment(
  asset: { uri: string; fileName?: string | null; mimeType?: string | null; width?: number; height?: number; fileSize?: number | null },
): Promise<MobileSupportMediaBody["attachment"]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error("Sign in again to send photos.")

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Sign in again to send photos.")

  const mime_type = mimeForAsset(asset.mimeType)
  const ext = extensionForMime(mime_type)
  const objectId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const path = `${user.id}/${objectId}.${ext}`

  const fileResponse = await fetch(asset.uri)
  if (!fileResponse.ok) throw new Error("Could not read that photo.")
  const bytes = await fileResponse.arrayBuffer()
  const size_bytes = asset.fileSize ?? bytes.byteLength
  if (size_bytes > MAX_IMAGE_BYTES) {
    throw new Error("This photo is over 20MB. Choose a smaller one.")
  }

  const { error } = await supabase.storage.from(SUPPORT_CASE_ATTACHMENTS_BUCKET).upload(path, bytes, {
    contentType: mime_type,
    upsert: false,
  })
  if (error) throw new Error(error.message || "Could not upload that photo.")

  return {
    kind: "image",
    path,
    file_name: safeFileName(asset.fileName, ext),
    mime_type,
    size_bytes,
    width: asset.width && asset.width > 0 ? Math.round(asset.width) : undefined,
    height: asset.height && asset.height > 0 ? Math.round(asset.height) : undefined,
  }
}
