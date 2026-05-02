import { NextResponse } from "next/server"
import { isValidBlogImagesObjectPath } from "@/lib/blog/blog-media-proxy-path-validation"

const PUBLIC_BLOG_MARKER = "/storage/v1/object/public/blog-images/"

function contentTypeFallback(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 })
  }
  const path = segments.map((s) => decodeURIComponent(s)).join("/")
  if (!isValidBlogImagesObjectPath(path)) {
    return new NextResponse("Not found", { status: 404 })
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!base) {
    return new NextResponse("Server misconfiguration", { status: 500 })
  }

  const encodedPath = path.split("/").map((p) => encodeURIComponent(p)).join("/")
  const upstreamUrl = `${base}${PUBLIC_BLOG_MARKER}${encodedPath}`

  let res: Response
  try {
    res = await fetch(upstreamUrl, {
      headers: { Accept: "image/*" },
    })
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  }

  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
