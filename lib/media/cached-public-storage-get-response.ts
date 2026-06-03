import { NextResponse } from "next/server"
import {
  cachedPublicStorageObjectBody,
  getCachedPublicStorageObject,
  type PublicStorageBucket,
} from "@/lib/cache/public-storage-object"
import { PUBLIC_MEDIA_CACHE_CONTROL } from "@/lib/listing-media-cache-control"

export async function cachedPublicStorageGetResponse(opts: {
  bucket: PublicStorageBucket
  objectPath: string
  publicMarker: string
  contentTypeFallback: (filename: string) => string
}): Promise<NextResponse> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!base) {
    return new NextResponse("Server misconfiguration", { status: 500 })
  }

  const encodedPath = opts.objectPath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")
  const upstreamUrl = `${base}${opts.publicMarker}${encodedPath}`

  const cached = await getCachedPublicStorageObject(opts.bucket, opts.objectPath, upstreamUrl)
  if (!cached) {
    return new NextResponse("Not found", { status: 404 })
  }

  const fileSeg = opts.objectPath.split("/").pop() ?? ""
  const ct =
    cached.contentType !== "application/octet-stream"
      ? cached.contentType
      : opts.contentTypeFallback(fileSeg)

  const buf = cachedPublicStorageObjectBody(cached)
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
    },
  })
}
