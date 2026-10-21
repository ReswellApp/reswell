import assert from "node:assert/strict"
import test from "node:test"
import { handleMcpHttpRequest } from "@/lib/services/mcpServer"
import { listMcpToolsForPrincipal, MCP_INSTRUCTIONS } from "@/lib/services/mcpToolCatalog"
import type { McpAccessPrincipal } from "@/lib/types/mcp"

test("unauthenticated MCP POST returns 401 with resource_metadata pointer", async () => {
  const result = await handleMcpHttpRequest({
    method: "POST",
    authorizationHeader: null,
    body: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
  })
  assert.equal(result.kind, "unauthorized")
  if (result.kind !== "unauthorized") return
  assert.match(result.wwwAuthenticate, /resource_metadata=/)
  assert.match(result.wwwAuthenticate, /oauth-protected-resource/)
})

test("tools/list is filtered by approved scopes", () => {
  const principal: McpAccessPrincipal = {
    tokenId: "t1",
    userId: "u1",
    clientId: "c1",
    scopes: ["search"],
    resource: "https://www.reswell.app/api/mcp",
  }
  const tools = listMcpToolsForPrincipal(principal)
  const names = tools.map((t) => t.name)
  assert.ok(names.includes("browse_listings"))
  assert.ok(names.includes("search_listings"))
  assert.ok(names.includes("get_listing"))
  assert.ok(names.includes("get_pricing"))
  assert.ok(!names.includes("get_cart"))
  assert.ok(!names.includes("add_to_cart"))
  assert.ok(!names.includes("prepare_purchase"))
})

test("instructions tell the model not to paraphrase checkout URLs", () => {
  assert.match(MCP_INSTRUCTIONS, /checkout_url/)
  assert.match(MCP_INSTRUCTIONS, /exactly as returned/)
  assert.match(MCP_INSTRUCTIONS, /does not charge a card/i)
})
