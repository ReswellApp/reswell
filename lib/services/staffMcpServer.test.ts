import assert from "node:assert/strict"
import test from "node:test"
import { handleStaffMcpHttpRequest } from "@/lib/services/staffMcpServer"
import {
  listStaffMcpToolsForPrincipal,
  STAFF_MCP_INSTRUCTIONS,
} from "@/lib/services/staffMcpToolCatalog"
import type { McpAccessPrincipal } from "@/lib/types/mcp"

test("unauthenticated staff MCP POST returns 401 with staff resource_metadata", async () => {
  const result = await handleStaffMcpHttpRequest({
    method: "POST",
    authorizationHeader: null,
    body: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
  })
  assert.equal(result.kind, "unauthorized")
  if (result.kind !== "unauthorized") return
  assert.match(result.wwwAuthenticate, /resource_metadata=/)
  assert.match(result.wwwAuthenticate, /staff-mcp/)
})

test("staff tools/list is filtered by approved scopes", () => {
  const principal: McpAccessPrincipal = {
    tokenId: "t1",
    userId: "u1",
    clientId: "c1",
    scopes: ["catalog:read", "blog:write"],
    resource: "https://www.reswell.app/api/staff-mcp",
  }
  const tools = listStaffMcpToolsForPrincipal(principal)
  const names = tools.map((t) => t.name)
  assert.ok(names.includes("list_brands"))
  assert.ok(names.includes("get_brand"))
  assert.ok(!names.includes("create_brand"))
  assert.ok(names.includes("create_blog_post"))
  assert.ok(names.includes("update_blog_post"))
  assert.ok(!names.includes("list_blog_posts"))
})

test("staff instructions mention live writes without deploy", () => {
  assert.match(STAFF_MCP_INSTRUCTIONS, /production/i)
  assert.match(STAFF_MCP_INSTRUCTIONS, /no git commit/i)
  assert.match(STAFF_MCP_INSTRUCTIONS, /published:false/)
})
