import assert from "node:assert/strict"
import test from "node:test"
import vm from "node:vm"
import {
  getMcpShopResourceUris,
  getMcpShopToolUiMeta,
  listMcpUiResources,
  readMcpUiResource,
} from "@/lib/mcp-widgets/resources"
import { shopBrowseStatus, shopListingLines } from "@/lib/mcp-widgets/shop-copy"
import { buildReswellShopWidgetHtml } from "@/lib/mcp-widgets/shop-widget-html"
import { listMcpToolsForPrincipal, MCP_INSTRUCTIONS } from "@/lib/services/mcpToolCatalog"
import type { McpAccessPrincipal } from "@/lib/types/mcp"

test("shop widget HTML is self-contained and branded", () => {
  const html = buildReswellShopWidgetHtml()
  assert.match(html, /<title>Reswell<\/title>/)
  assert.match(html, /ui\/initialize/)
  assert.match(html, /add_to_cart/)
  assert.match(html, /state\.shopping/)
  assert.match(html, /data-open/)
  assert.match(html, /prepare_purchase/)
  assert.match(html, /reswell\/shop/)
  assert.match(html, /readableStatus/)
  assert.match(html, /formatDimensions/)
  assert.match(html, /#04070E/)
  assert.match(html, /reswell-logo\.png/)
  assert.ok(!html.includes("#0b1c24"))
  assert.ok(!html.includes("http://fonts.googleapis.com"))
})

test("widget renders cards and hides a JSON tool payload", async () => {
  const html = buildReswellShopWidgetHtml()
  assert.match(html, /\/\\bin\\s\*\$\/i/)
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1]
  assert.ok(script)

  const listeners = new Map<string, (event: { data?: unknown; detail?: unknown }) => void>()
  function makeEl() {
    return {
      hidden: false,
      textContent: "",
      innerHTML: "",
      scrollHeight: 320,
      classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {},
      addEventListener() {},
      getAttribute() {
        return null
      },
      hasAttribute() {
        return false
      },
      closest() {
        return null
      },
      style: {},
    }
  }
  const byId = new Map<string, ReturnType<typeof makeEl>>()
  const document = {
    getElementById(id: string) {
      const existing = byId.get(id)
      if (existing) return existing
      const created = makeEl()
      byId.set(id, created)
      return created
    },
    documentElement: { scrollHeight: 320 },
    body: makeEl(),
  }
  const previous = {
    document: (globalThis as { document?: unknown }).document,
    window: (globalThis as { window?: unknown }).window,
    setTimeout: globalThis.setTimeout,
  }
  const sandboxWindow = {
    parent: { postMessage() {} },
    addEventListener(type: string, fn: (event: { data?: unknown }) => void) {
      listeners.set(type, fn)
    },
    open() {},
  }
  ;(globalThis as { document?: unknown }).document = document
  ;(globalThis as { window?: unknown }).window = sandboxWindow
  globalThis.setTimeout = ((fn: () => void) => {
    fn()
    return 0
  }) as unknown as typeof setTimeout

  try {
    vm.runInThisContext(script as string)
    const dump = JSON.stringify({
      type: "listings",
      results: [{ id: "secret", title: "SECRET JSON TITLE" }],
    })
    listeners.get("message")?.({
      data: {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: {
          structuredContent: {
            view: "browse",
            query: "channel islands",
            message: dump,
            cart: { items: [], item_count: 9 },
            listings: [
              {
                id: "1",
                title: "5'5 Channel Islands Pod",
                dimensions: '{"v":2,"L":"5\'5","W":"19 1/4","T":"2 3/8"}',
                condition_label: "Good",
                price_usd: 485,
                city: "SANTA BARBARA",
                state: "CA",
                image_url: "https://www.reswell.app/media/example.webp",
                urls: { html: "https://www.reswell.app/l/pod" },
              },
            ],
          },
        },
      },
    })
    const status = byId.get("status")?.textContent ?? ""
    const browse = byId.get("browsePane")?.innerHTML ?? ""
    const count = byId.get("cartCount")?.textContent ?? ""
    assert.equal(status, "1 board for “channel islands”.")
    assert.equal(count, "9")
    assert.match(browse, /Channel Islands Pod/)
    assert.match(browse, /5'5 × 19 1\/4″ × 2 3\/8″/)
    assert.match(browse, /Santa Barbara, CA/)
    assert.match(browse, /\$485/)
    assert.ok(!browse.includes("SECRET JSON TITLE"))
    assert.ok(!browse.includes('{"v"'))
    assert.ok(!status.includes("{"))

    const rawDump = JSON.stringify({
      type: "listings",
      results: [
        {
          id: "2",
          title: "Album Ledge 6'4",
          dimensions: '{"v":2,"L":"6\'4","W":"19 1/2","T":"2 5/8"}',
          condition_label: "Excellent",
          price_usd: 640,
          city: "SANTA BARBARA",
          state: "CA",
        },
      ],
    })
    listeners.get("message")?.({
      data: {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: {
          structuredContent: JSON.parse(rawDump),
          message: rawDump,
        },
      },
    })
    const rawStatus = byId.get("status")?.textContent ?? ""
    const rawBrowse = byId.get("browsePane")?.innerHTML ?? ""
    assert.equal(rawStatus, "1 board.")
    assert.match(rawBrowse, /Album Ledge/)
    assert.match(rawBrowse, /6'4 × 19 1\/2″ × 2 5\/8″/)
    assert.ok(!rawBrowse.includes('"type"'))
    assert.ok(!rawStatus.includes("{"))
    await Promise.resolve()
    await Promise.resolve()
  } finally {
    ;(globalThis as { document?: unknown }).document = previous.document
    ;(globalThis as { window?: unknown }).window = previous.window
    globalThis.setTimeout = previous.setTimeout
  }
})

test("shop status stays a short line and listing lines are not a JSON dump", () => {
  assert.equal(shopBrowseStatus(4, "Channel Islands"), "4 boards for “Channel Islands”.")
  assert.equal(shopBrowseStatus(1, ""), "1 board.")
  const lines = shopListingLines([
    {
      title: "Album Ledge",
      price_usd: 450,
      condition_label: "Excellent",
      dimensions: "6'4″ × 19 1/2″ × 2 5/8″",
      urls: { html: "https://www.reswell.app/l/album-ledge" },
    },
  ])
  assert.match(lines, /Album Ledge/)
  assert.match(lines, /\$450/)
  assert.ok(!lines.includes("{"))
  assert.ok(!shopBrowseStatus(2, "pod").includes("{"))
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
