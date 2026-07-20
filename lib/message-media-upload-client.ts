import {
  MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
  type MarketplaceMessageImageAttachment,
  type MarketplaceMessageVideoAttachment,
} from "@/lib/validations/marketplace-message-attachment"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import {
  assertAcceptedMessageMediaFile,
  assertMessageImageOriginalSize,
  assertMessageVideoDuration,
  assertMessageVideoOriginalSize,
  isAcceptedMessageVideoFile,
  messageVideoExtensionForMime,
  normalizeMessageVideoMimeType,
  prepareMessageImageFromFile,
} from "@/lib/message-media-pipeline"
import { uploadStorageObjectWithProgress } from "@/lib/supabase/storage-upload-xhr"
import { isAbortError } from "@/lib/utils/is-abort-error"

const UPLOAD_RETRY_ATTEMPTS = 3
const UPLOAD_RETRY_BASE_DELAY_MS = 500

function displayFileName(raw: string, fallbackExt: string): string {
  const base = raw.replace(/^.*[/\\]/, "").trim() || `attachment.${fallbackExt}`
  return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Upload aborted", "AbortError"))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function isRetryableUploadError(err: unknown): boolean {
  if (isAbortError(err)) return false
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  if (lower.includes("network error")) return true
  if (/upload failed \(5\d\d\)/i.test(message)) return true
  if (/upload failed \(408\)/i.test(message)) return true
  if (/upload failed \(429\)/i.test(message)) return true
  return false
}

async function uploadWithRetry(opts: {
  supabaseUrl: string
  accessToken: string
  anonKey: string
  pathInBucket: string
  body: Blob
  contentType: string
  onProgress?: (loaded: number, total: number) => void
  signal?: AbortSignal
}): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
    if (opts.signal?.aborted) {
      throw new DOMException("Upload aborted", "AbortError")
    }
    try {
      await uploadStorageObjectWithProgress({
        supabaseUrl: opts.supabaseUrl,
        accessToken: opts.accessToken,
        anonKey: opts.anonKey,
        bucket: MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
        pathInBucket: opts.pathInBucket,
        body: opts.body,
        contentType: opts.contentType,
        upsert: false,
        signal: opts.signal,
        onProgress: opts.onProgress
          ? (p) => opts.onProgress?.(p.loaded, p.total)
          : undefined,
      })
      return
    } catch (err) {
      lastError = err
      if (!isRetryableUploadError(err) || attempt >= UPLOAD_RETRY_ATTEMPTS) {
        throw err
      }
      await sleep(UPLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), opts.signal)
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Upload failed")
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
  /** 0–1 while decoding/resizing before bytes hit the network. */
  onPrepareProgress?: (ratio: number) => void
  signal?: AbortSignal
}): Promise<UploadedMessageImageAttachment | UploadedMessageVideoAttachment> {
  const {
    file,
    conversationId,
    supabaseUrl,
    accessToken,
    anonKey,
    onProgress,
    onPrepareProgress,
    signal,
  } = opts

  assertAcceptedMessageMediaFile(file)
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError")
  }

  if (isAcceptedMessageVideoFile(file)) {
    assertMessageVideoOriginalSize(file)
    await assertMessageVideoDuration(file)
    if (signal?.aborted) {
      throw new DOMException("Upload aborted", "AbortError")
    }
    const mimeType = normalizeMessageVideoMimeType(file)
    const ext = messageVideoExtensionForMime(mimeType)
    const objectId = crypto.randomUUID()
    const pathInBucket = `${conversationId}/${objectId}.${ext}`
    const safeName = displayFileName(file.name, ext)

    onPrepareProgress?.(1)
    await uploadWithRetry({
      supabaseUrl,
      accessToken,
      anonKey,
      pathInBucket,
      body: file,
      contentType: mimeType,
      onProgress,
      signal,
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
  onPrepareProgress?.(0.15)
  const source = await ensureBrowserDecodableImageFile(file)
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError")
  }
  onPrepareProgress?.(0.55)
  const prepared = await prepareMessageImageFromFile(source)
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError")
  }
  onPrepareProgress?.(1)

  const objectId = crypto.randomUUID()
  const pathInBucket = `${conversationId}/${objectId}.${prepared.ext}`
  const safeName = displayFileName(file.name, prepared.ext)

  await uploadWithRetry({
    supabaseUrl,
    accessToken,
    anonKey,
    pathInBucket,
    body: prepared.blob,
    contentType: prepared.contentType,
    onProgress,
    signal,
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
