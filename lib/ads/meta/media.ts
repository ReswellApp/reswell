import "server-only"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import { VIDEO_CHUNK_BYTES, safeMediaName } from "@/lib/ads/manager/media"
import { getMetaAdAccountId } from "@/lib/ads/meta/config"
import { metaPostMultipart, metaPostVideoForm } from "@/lib/ads/meta/http"

const MAX_CHUNKS = 80

export async function uploadMetaImageBytes(input: { filename: string; bytes: Uint8Array; mime: string }): Promise<string> {
  const accountId = requireAccount()
  const name = safeMediaName(input.filename)
  const form = new FormData()
  form.set("filename", new Blob([bufferOf(input.bytes)], { type: input.mime }), name)
  const uploaded = await metaPostMultipart(`act_${accountId}/adimages`, form)
  const hash = readMetaImageHash(uploaded)
  if (!hash) throw new AdsPlatformError("Meta did not accept the image", "meta")
  return hash
}

export async function uploadMetaVideo(input: { filename: string; bytes: Uint8Array; mime: string }): Promise<string> {
  const accountId = requireAccount()
  const path = `act_${accountId}/advideos`
  const name = safeMediaName(input.filename)
  const started = await metaPostVideoForm(path, {
    upload_phase: "start",
    file_size: String(input.bytes.length),
  })
  const sessionId = stringField(started, "upload_session_id")
  if (!sessionId) throw new AdsPlatformError("Meta did not start the video upload", "meta")

  let start = numberField(started, "start_offset") ?? 0
  let end = numberField(started, "end_offset") ?? Math.min(VIDEO_CHUNK_BYTES, input.bytes.length)
  for (let step = 0; step < MAX_CHUNKS && start < input.bytes.length; step += 1) {
    const sliceEnd = Math.min(end > start ? end : start + VIDEO_CHUNK_BYTES, input.bytes.length)
    const chunk = input.bytes.subarray(start, sliceEnd)
    const form = new FormData()
    form.set("upload_phase", "transfer")
    form.set("upload_session_id", sessionId)
    form.set("start_offset", String(start))
    form.set("video_file_chunk", new Blob([bufferOf(chunk)], { type: input.mime }), name)
    const transferred = await metaPostMultipart(path, form, { video: true, timeoutMs: 45_000 })
    const nextStart = numberField(transferred, "start_offset")
    if (nextStart == null || nextStart <= start) {
      throw new AdsPlatformError("Meta video upload stalled", "meta")
    }
    start = nextStart
    const nextEnd = numberField(transferred, "end_offset")
    end = nextEnd != null && nextEnd > start ? nextEnd : start + VIDEO_CHUNK_BYTES
  }
  if (start < input.bytes.length) throw new AdsPlatformError("Meta video upload did not finish", "meta")

  const finished = await metaPostVideoForm(path, {
    upload_phase: "finish",
    upload_session_id: sessionId,
    title: name,
  })
  const videoId = stringField(started, "video_id") ?? stringField(finished, "video_id") ?? stringField(finished, "id")
  if (!videoId) throw new AdsPlatformError("Meta did not return a video id", "meta")
  return videoId
}

export function readMetaImageHash(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const images = (payload as { images?: Record<string, { hash?: string }> }).images
  if (!images) return null
  for (const image of Object.values(images)) {
    if (image?.hash) return image.hash
  }
  return null
}

function requireAccount(): string {
  const accountId = getMetaAdAccountId()
  if (!accountId) throw new AdsPlatformError("Meta Ads is not connected", "meta")
  return accountId
}

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function stringField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null
  const value = (payload as Record<string, unknown>)[key]
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value))
  return null
}

function numberField(payload: unknown, key: string): number | null {
  const raw = stringField(payload, key)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}
