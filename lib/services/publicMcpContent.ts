import { MCP_SHOP_META_KEY } from "@/lib/mcp-widgets/constants"
import type { McpToolCallResult } from "@/lib/types/mcp"

const MAX_PHOTO_LINKS = 24

export function imageMimeTypeFromUrl(url: string): string {
  const path = url.split("?")[0]?.split("#")[0]?.toLowerCase() ?? ""
  if (path.endsWith(".png")) return "image/png"
  if (path.endsWith(".webp")) return "image/webp"
  if (path.endsWith(".gif")) return "image/gif"
  if (path.endsWith(".avif")) return "image/avif"
  return "image/jpeg"
}

/** Pull listing photo URLs out of a public research payload. Ignores HTML page links. */
export function collectListingImageUrls(data: unknown): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  const push = (value: unknown) => {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return
    const url = value.trim()
    if (seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }

  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    const obj = value as Record<string, unknown>
    push(obj.image_url)
    if (Array.isArray(obj.image_urls)) {
      for (const url of obj.image_urls) push(url)
    }
    if (Array.isArray(obj.listings)) walk(obj.listings)
    if (Array.isArray(obj.results)) walk(obj.results)
  }

  walk(data)
  return urls.slice(0, MAX_PHOTO_LINKS)
}

function browseStatus(listings: unknown, query: unknown): string | null {
  if (!Array.isArray(listings)) return null
  const label = typeof query === "string" && query.trim() ? ` for “${query.trim()}”` : ""
  return `Showing ${listings.length} listing(s)${label}. Photos are on the cards and in image_url. This lookup is read-only.`
}

/** Mark a tool result as browse-only and attach photo resource links. */
export function withPublicMcpPhotos(result: McpToolCallResult): McpToolCallResult {
  const structuredContent: Record<string, unknown> = {
    ...(result.structuredContent ?? {}),
    shopping: false,
  }
  const status = browseStatus(structuredContent.listings, structuredContent.query)
  if (status && structuredContent.view === "browse") {
    structuredContent.message = status
  }

  const meta: Record<string, unknown> = { ...(result._meta ?? {}) }
  const shop = meta[MCP_SHOP_META_KEY]
  if (shop && typeof shop === "object") {
    meta[MCP_SHOP_META_KEY] = {
      ...(shop as Record<string, unknown>),
      shopping: false,
      ...(status && structuredContent.view === "browse" ? { message: status } : {}),
    }
  }

  const content =
    status &&
    structuredContent.view === "browse" &&
    result.content[0]?.type === "text" &&
    result.content[0].text.startsWith("Opened the Reswell board picker")
      ? result.content.map((item, index) =>
          index === 0 && item.type === "text" ? { type: "text" as const, text: status } : item,
        )
      : result.content

  const photos = collectListingImageUrls(structuredContent).map((uri, index) => ({
    type: "resource_link" as const,
    uri,
    name: `listing-photo-${index + 1}`,
    title: `Listing photo ${index + 1}`,
    mimeType: imageMimeTypeFromUrl(uri),
  }))

  return {
    ...result,
    structuredContent,
    ...(Object.keys(meta).length > 0 ? { _meta: meta } : {}),
    content: [...content, ...photos],
  }
}
