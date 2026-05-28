import { NextResponse } from "next/server"
import { evaluateListingMediaAccess } from "@/lib/listing-media-crawler-guard"
import { LISTING_MEDIA_CACHE_CONTROL } from "@/lib/listing-media-cache-control"
import { isValidListingMediaObjectPath } from "@/lib/listing-media-proxy-path-validation"

const PUBLIC_LISTINGS_MARKER = "/storage/v1/object/public/listings/"

function contentTypeFallback(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const access = evaluateListingMediaAccess(request)
  if (!access.allowed) {
    return new NextResponse(access.message, {
      status: access.status,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const { path: segments } = await ctx.params
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 })
  }
  const path = segments.map((s) => decodeURIComponent(s)).join("/")
  if (!isValidListingMediaObjectPath(path)) {
    return new NextResponse("Not found", { status: 404 })
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!base) {
    return new NextResponse("Server misconfiguration", { status: 500 })
  }

  const encodedPath = path.split("/").map((p) => encodeURIComponent(p)).join("/")
  const upstreamUrl = `${base}${PUBLIC_LISTINGS_MARKER}${encodedPath}`

  let res: Response
  try {
    res = await fetch(upstreamUrl, { headers: { Accept: "image/*" } })
  } catch {
    return new NextResponse("Bad gateway", { status: 502 })
  }

  if (!res.ok) {
    return new NextResponse("Not found", { status: res.status === 404 ? 404 : 502 })
  }

  const fileSeg = segments[segments.length - 1] ?? ""
  const decodedFile = decodeURIComponent(fileSeg)
  const ct =
    res.headers.get("content-type")?.split(";")[0]?.trim() || contentTypeFallback(decodedFile)

  const body = res.body
  if (body) {
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": LISTING_MEDIA_CACHE_CONTROL,
      },
    })
  }

  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": LISTING_MEDIA_CACHE_CONTROL,
    },
  })
}
