import assert from "node:assert/strict"
import test from "node:test"
import {
  getMcpShopResourceUris,
  getMcpShopToolUiMeta,
  listMcpUiResources,
  readMcpUiResource,
} from "@/lib/mcp-widgets/resources"
import { buildReswellShopWidgetHtml } from "@/lib/mcp-widgets/shop-widget-html"
import { listMcpToolsForPrincipal, MCP_INSTRUCTIONS } from "@/lib/services/mcpToolCatalog"
import type { McpAccessPrincipal } from "@/lib/types/mcp"

test("shop widget HTML is self-contained and branded", () => {
  const html = buildReswellShopWidgetHtml()
  assert.match(html, /<title>Reswell<\/title>/)
  assert.match(html, /ui\/initialize/)
  assert.match(html, /add_to_cart/)
  assert.match(html, /prepare_purchase/)
  assert.match(html, /reswell\/shop/)
  assert.ok(!html.includes("http://fonts.googleapis.com"))
})

test("UI resources expose MCP Apps and ChatGPT skybridge templates", () => {
  const resources = listMcpUiResources()
  assert.equal(resources.length, 2)
  assert.ok(resources.some((r) => r.mimeType === "text/html;profile=mcp-app"))
  assert.ok(resources.some((r) => r.mimeType === "text/html+skybridge"))

  const { resourceUri, skybridgeUri } = getMcpShopResourceUris()
  const mcp = readMcpUiResource(resourceUri)
  const sky = readMcpUiResource(skybridgeUri)
  assert.ok(mcp?.text.includes("Reswell"))
  assert.ok(sky?.text.includes("Reswell"))
  assert.deepEqual(mcp?._meta?.ui && typeof mcp._meta.ui, "object")
})

test("UI-linked tools advertise resourceUri meta", () => {
  const principal: McpAccessPrincipal = {
    tokenId: "t1",
    userId: "u1",
    clientId: "c1",
    scopes: ["search", "cart:read", "cart:write", "checkout"],
    resource: "https://www.reswell.app/api/mcp",
  }
  const tools = listMcpToolsForPrincipal(principal)
  const browse = tools.find((t) => t.name === "browse_listings")
  assert.ok(browse)
  const meta = getMcpShopToolUiMeta()
  assert.deepEqual(browse?._meta, meta)
  assert.equal(
    (browse?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri,
    getMcpShopResourceUris().resourceUri,
  )
  assert.match(MCP_INSTRUCTIONS, /browse_listings/)
})
