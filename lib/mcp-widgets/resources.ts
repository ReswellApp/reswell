import { createHash } from "node:crypto"
import {
  MCP_SHOP_META_KEY,
  MCP_SKYBRIDGE_MIME,
  MCP_UI_MIME,
  mcpShopResourceUri,
  mcpShopSkybridgeUri,
  mcpShopToolUiMeta,
  mcpShopWidgetVersion,
  mcpWidgetConnectDomains,
  mcpWidgetResourceDomains,
} from "@/lib/mcp-widgets/constants"
import { buildReswellShopWidgetHtml } from "@/lib/mcp-widgets/shop-widget-html"

let cachedHtml: string | null = null
let cachedVersion: string | null = null

function shopHtml(): string {
  if (!cachedHtml) {
    cachedHtml = buildReswellShopWidgetHtml()
    cachedVersion = mcpShopWidgetVersion(cachedHtml)
  }
  return cachedHtml
}

function shopVersion(): string {
  shopHtml()
  return cachedVersion ?? "dev"
}

export function getMcpShopResourceUris(): {
  resourceUri: string
  skybridgeUri: string
  version: string
} {
  const version = shopVersion()
  return {
    version,
    resourceUri: mcpShopResourceUri(version),
    skybridgeUri: mcpShopSkybridgeUri(version),
  }
}

export function getMcpShopToolUiMeta(): Record<string, unknown> {
  const { resourceUri, skybridgeUri } = getMcpShopResourceUris()
  return mcpShopToolUiMeta(resourceUri, skybridgeUri)
}

function resourceCspMeta(): Record<string, unknown> {
  return {
    ui: {
      csp: {
        resourceDomains: mcpWidgetResourceDomains(),
        connectDomains: mcpWidgetConnectDomains(),
      },
    },
  }
}

function openaiCspMeta(): Record<string, unknown> {
  return {
    "openai/widgetCSP": {
      connect_domains: mcpWidgetConnectDomains(),
      resource_domains: mcpWidgetResourceDomains(),
    },
  }
}

export function listMcpUiResources(): Array<{
  uri: string
  name: string
  description: string
  mimeType: string
  _meta?: Record<string, unknown>
}> {
  const { resourceUri, skybridgeUri } = getMcpShopResourceUris()
  return [
    {
      uri: resourceUri,
      name: "Reswell shop",
      description: "Interactive board picker and cart for AI shopping hosts",
      mimeType: MCP_UI_MIME,
      _meta: resourceCspMeta(),
    },
    {
      uri: skybridgeUri,
      name: "Reswell shop (ChatGPT)",
      description: "Skybridge template for ChatGPT Apps",
      mimeType: MCP_SKYBRIDGE_MIME,
      _meta: openaiCspMeta(),
    },
  ]
}

export function readMcpUiResource(uri: string): {
  uri: string
  mimeType: string
  text: string
  _meta?: Record<string, unknown>
} | null {
  const { resourceUri, skybridgeUri } = getMcpShopResourceUris()
  const html = shopHtml()
  if (uri === resourceUri) {
    return {
      uri: resourceUri,
      mimeType: MCP_UI_MIME,
      text: html,
      _meta: resourceCspMeta(),
    }
  }
  if (uri === skybridgeUri) {
    return {
      uri: skybridgeUri,
      mimeType: MCP_SKYBRIDGE_MIME,
      text: html,
      _meta: openaiCspMeta(),
    }
  }
  return null
}

export { MCP_SHOP_META_KEY }

/** Stable fingerprint for tests (not the deploy URI version). */
export function mcpShopWidgetContentHash(): string {
  return createHash("sha256").update(shopHtml(), "utf8").digest("hex")
}
