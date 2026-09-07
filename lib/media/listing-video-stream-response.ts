import { NextResponse } from "next/server"
import { PUBLIC_MEDIA_CACHE_CONTROL } from "@/lib/listing-media-cache-control"

const PUBLIC_LISTINGS_MARKER = "/storage/v1/object/public/listings/"

/**
 * Chrome / Android reject `video/quicktime` even when the bitstream is H.264.
 * Advertise MOV as MP4 so the browser will fetch and sniff the container.
 */
export function listingVideoPlaybackContentType(
  fileName: string,
  upstreamType: string | null | undefined,
): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return "video/mp4"
  const t = upstreamType?.split(";")[0]?.trim().toLowerCase()
  if (t === "video/webm" || t.startsWith("video/webm")) return "video/webm"
  return "video/mp4"
}

/** Streams a listings-bucket video with Range support. Does not buffer the body. */
export async function listingVideoStreamResponse(opts: {
  request: Request
  objectPath: string
}): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "")
  if (!base) {
    return new NextResponse("Server misconfiguration", { status: 500 })
  }

  const encodedPath = opts.objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  const upstreamUrl = `${base}${PUBLIC_LISTINGS_MARKER}${encodedPath}`

  const headers = new Headers()
  const range = opts.request.headers.get("range")
  if (range) headers.set("Range", range)

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, { headers, cache: "no-store" })
  } catch {
    return new NextResponse("Bad gateway", { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse("Not found", { status: upstream.status === 404 ? 404 : 502 })
  }

  const fileName = opts.objectPath.split("/").pop() ?? ""
  const out = new Headers()
  out.set(
    "Content-Type",
    listingVideoPlaybackContentType(fileName, upstream.headers.get("content-type")),
  )
  out.set("Accept-Ranges", "bytes")
  const contentLength = upstream.headers.get("content-length")
  if (contentLength) out.set("Content-Length", contentLength)
  const contentRange = upstream.headers.get("content-range")
  if (contentRange) out.set("Content-Range", contentRange)
  out.set("Cache-Control", PUBLIC_MEDIA_CACHE_CONTROL)

  return new Response(upstream.body, {
    status: upstream.status,
    headers: out,
  })
}
