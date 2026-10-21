import { createHash } from "node:crypto"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export const MCP_UI_MIME = "text/html;profile=mcp-app"
export const MCP_SKYBRIDGE_MIME = "text/html+skybridge"
export const MCP_UI_EXTENSION_ID = "io.modelcontextprotocol/ui"

export const MCP_SHOP_META_KEY = "reswell/shop"

/** Content hash so hosts refetch when the widget bundle changes. */
export function mcpShopWidgetVersion(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex").slice(0, 8)
}

export function mcpShopResourceUri(version: string): string {
  return `ui://reswell/shop-${version}.html`
}

export function mcpShopSkybridgeUri(version: string): string {
  return `ui://reswell/shop-${version}.skybridge.html`
}

export function mcpWidgetResourceDomains(): string[] {
  const domains = new Set<string>([
    "https://www.reswell.app",
    "https://reswell.app",
    "https://*.supabase.co",
  ])
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (supabase) {
    try {
      domains.add(new URL(supabase).origin)
    } catch {
      // ignore
    }
  }
  const site = publicSiteOrigin()
  try {
    domains.add(new URL(site).origin)
  } catch {
    // ignore
  }
  return [...domains]
}

export function mcpWidgetConnectDomains(): string[] {
  return [publicSiteOrigin()]
}

export function mcpShopToolUiMeta(resourceUri: string, skybridgeUri: string): Record<string, unknown> {
  return {
    ui: { resourceUri },
    "openai/outputTemplate": skybridgeUri,
  }
}
