import assert from "node:assert/strict"
import test from "node:test"
import { MCP_SHOP_META_KEY } from "@/lib/mcp-widgets/constants"
import { collectListingImageUrls, withPublicMcpPhotos } from "@/lib/services/publicMcpContent"
import { handlePublicMcpHttpRequest } from "@/lib/services/publicMcpServer"
import { PUBLIC_MCP_INSTRUCTIONS } from "@/lib/services/mcpToolCatalog"
import type { McpAccessPrincipal, McpToolCallResult } from "@/lib/types/mcp"

const allow = async () => ({ ok: true as const, headers: { "X-RateLimit-Remaining": "9" } })

test("collectListingImageUrls keeps gallery photos and skips html links", () => {
  const urls = collectListingImageUrls({
    image_url: "https://cdn.example/board.jpg",
    urls: { html: "https://www.reswell.app/l/example" },
    image_urls: [
      "https://cdn.example/board.jpg",
      "https://cdn.example/rail.png",
    ],
    results: [{ image_url: "https://cdn.example/other.webp" }],
  })
  assert.deepEqual(urls, [
    "https://cdn.example/board.jpg",
    "https://cdn.example/rail.png",
    "https://cdn.example/other.webp",
  ])
})

test("withPublicMcpPhotos marks browse-only and attaches resource links", () => {
  const result = withPublicMcpPhotos({
    content: [{ type: "text", text: "boards" }],
    structuredContent: {
      listings: [{ image_url: "https://cdn.example/a.jpg" }],
    },
    _meta: {
      [MCP_SHOP_META_KEY]: {
        listings: [{ image_url: "https://cdn.example/a.jpg" }],
      },
    },
  })
  assert.equal(result.structuredContent?.shopping, false)
  const shop = result._meta?.[MCP_SHOP_META_KEY] as { shopping?: boolean }
  assert.equal(shop.shopping, false)

  const rewritten = withPublicMcpPhotos({
    content: [{ type: "text", text: "Opened the Reswell board picker with 1 listing(s)." }],
    structuredContent: {
      view: "browse",
      query: "twin pin",
      listings: [{ image_url: "https://cdn.example/a.jpg" }],
    },
  })
  assert.match(String(rewritten.structuredContent?.message), /read-only/)
  assert.match(rewritten.content[0]?.type === "text" ? rewritten.content[0].text : "", /twin pin/)
  const photo = result.content.find((item) => item.type === "resource_link")
  assert.ok(photo && photo.type === "resource_link")
  if (photo?.type !== "resource_link") return
  assert.equal(photo.uri, "https://cdn.example/a.jpg")
  assert.equal(photo.mimeType, "image/jpeg")
})

test("public MCP initialize does not require auth or consume a rate limit", async () => {
  let consumed = 0
  const result = await handlePublicMcpHttpRequest({
    method: "POST",
    body: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    consumeToolCall: async () => {
      consumed += 1
      return allow()
    },
  })
  assert.equal(consumed, 0)
  assert.equal(result.kind, "json")
  if (result.kind !== "json") return
  const body = result.body as {
    result: { serverInfo: { name: string }; instructions: string }
  }
  assert.equal(body.result.serverInfo.name, "reswell-public-mcp")
  assert.equal(body.result.instructions, PUBLIC_MCP_INSTRUCTIONS)
})

test("public tools/list is search and photos only", async () => {
  const result = await handlePublicMcpHttpRequest({
    method: "POST",
    body: { jsonrpc: "2.0", id: 2, method: "tools/list" },
    consumeToolCall: allow,
  })
  assert.equal(result.kind, "json")
  if (result.kind !== "json") return
  const body = result.body as { result: { tools: Array<{ name: string }> } }
  const names = body.result.tools.map((tool) => tool.name)
  assert.deepEqual(names, ["browse_listings", "search_listings", "get_listing", "get_pricing"])
})

test("public tools/call refuses cart tools before they run", async () => {
  let calls = 0
  const result = await handlePublicMcpHttpRequest({
    method: "POST",
    body: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "add_to_cart", arguments: { listing_ids: ["x"] } },
    },
    consumeToolCall: allow,
    callTool: async () => {
      calls += 1
      return { content: [{ type: "text", text: "should not run" }], isError: true }
    },
  })
  assert.equal(calls, 0)
  assert.equal(result.kind, "json")
  if (result.kind !== "json") return
  const body = result.body as { result: { isError?: boolean; content: Array<{ text?: string }> } }
  assert.equal(body.result.isError, true)
  assert.match(body.result.content[0]?.text ?? "", /signed-in MCP/)
})

test("public tools/call rate limit does not execute the tool", async () => {
  let calls = 0
  const result = await handlePublicMcpHttpRequest({
    method: "POST",
    body: {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_listing", arguments: { listing_id: "board" } },
    },
    consumeToolCall: async () => ({
      ok: false,
      status: 429,
      body: { error: "Too many requests" },
      headers: { "Retry-After": "30" },
    }),
    callTool: async () => {
      calls += 1
      const empty: McpToolCallResult = {
        content: [{ type: "text", text: "no" }],
        isError: true,
      }
      return empty
    },
  })
  assert.equal(calls, 0)
  assert.equal(result.kind, "rate_limited")
  if (result.kind !== "rate_limited") return
  assert.equal(result.headers["Retry-After"], "30")
})

test("batch tools/call consumes one quota slot per call", async () => {
  let consumed = 0
  let calls = 0
  const result = await handlePublicMcpHttpRequest({
    method: "POST",
    body: [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_listing", arguments: { listing_id: "a" } },
      },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_listing", arguments: { listing_id: "b" } },
      },
    ],
    consumeToolCall: async () => {
      consumed += 1
      return allow()
    },
    callTool: async () => {
      calls += 1
      return { content: [{ type: "text" as const, text: "ok" }] }
    },
  })
  assert.equal(consumed, 2)
  assert.equal(calls, 2)
  assert.equal(result.kind, "json")
})

test("batch tools/call rate limit does not execute any tool", async () => {
  let consumed = 0
  let calls = 0
  const result = await handlePublicMcpHttpRequest({
    method: "POST",
    body: [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_listing", arguments: { listing_id: "a" } },
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_listing", arguments: { listing_id: "b" } },
      },
    ],
    consumeToolCall: async () => {
      consumed += 1
      if (consumed === 2) {
        return {
          ok: false as const,
          status: 429 as const,
          body: { error: "Too many requests" },
          headers: { "Retry-After": "30" },
        }
      }
      return allow()
    },
    callTool: async () => {
      calls += 1
      return { content: [{ type: "text" as const, text: "no" }], isError: true }
    },
  })
  assert.equal(consumed, 2)
  assert.equal(calls, 0)
  assert.equal(result.kind, "rate_limited")
})

test("public resources/read serves a browse-only picker", async () => {
  const listed = await handlePublicMcpHttpRequest({
    method: "POST",
    body: { jsonrpc: "2.0", id: 7, method: "resources/list" },
    consumeToolCall: allow,
  })
  assert.equal(listed.kind, "json")
  if (listed.kind !== "json") return
  const uris = (listed.body as { result: { resources: Array<{ uri: string }> } }).result.resources
  const uri = uris[0]?.uri
  assert.ok(uri)

  const read = await handlePublicMcpHttpRequest({
    method: "POST",
    body: { jsonrpc: "2.0", id: 8, method: "resources/read", params: { uri } },
    consumeToolCall: allow,
  })
  assert.equal(read.kind, "json")
  if (read.kind !== "json") return
  const html = (read.body as { result: { contents: Array<{ text?: string }> } }).result.contents[0]
    ?.text
  assert.match(String(html), /shopping: false/)
  assert.match(String(html), /id="cartPill" hidden/)
  assert.match(String(html), /id="tabs" role="tablist" hidden/)
  assert.match(String(html), /id="dock" hidden/)
})

test("injected tool results gain photo links", async () => {
  const result = await handlePublicMcpHttpRequest({
    method: "POST",
    body: {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "get_listing", arguments: { listing_id: "slug" } },
    },
    consumeToolCall: allow,
    callTool: async (_principal: McpAccessPrincipal) => ({
      content: [{ type: "text" as const, text: "{\"image_urls\":[]}" }],
      structuredContent: {
        image_urls: ["https://cdn.example/deck.webp"],
      },
    }),
  })
  assert.equal(result.kind, "json")
  if (result.kind !== "json") return
  const body = result.body as {
    result: { content: Array<{ type: string; mimeType?: string }> }
  }
  const photo = body.result.content.find((item) => item.type === "resource_link")
  assert.equal(photo?.mimeType, "image/webp")
})
