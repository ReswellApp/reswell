import { NextResponse } from "next/server"
import { isValidBlogImagesObjectPath } from "@/lib/blog/blog-media-proxy-path-validation"
import { cachedPublicStorageGetResponse } from "@/lib/media/cached-public-storage-get-response"

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

  return cachedPublicStorageGetResponse({
    bucket: "blog-images",
    objectPath: path,
    publicMarker: PUBLIC_BLOG_MARKER,
    contentTypeFallback,
  })
}
