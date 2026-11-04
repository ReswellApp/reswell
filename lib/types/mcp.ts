/** Shopper MCP scopes (`/api/mcp`). */
export const MCP_SHOPPER_SCOPES = [
  "search",
  "cart:read",
  "cart:write",
  "checkout",
] as const

/** Staff MCP scopes (`/api/staff-mcp`) — brands, models, blog CMS. */
export const MCP_STAFF_SCOPES = [
  "catalog:read",
  "catalog:write",
  "blog:read",
  "blog:write",
] as const

export const MCP_SCOPES = [...MCP_SHOPPER_SCOPES, ...MCP_STAFF_SCOPES] as const

export type McpShopperScope = (typeof MCP_SHOPPER_SCOPES)[number]
export type McpStaffScope = (typeof MCP_STAFF_SCOPES)[number]
export type McpScope = (typeof MCP_SCOPES)[number]

export type McpResourceKind = "shopper" | "staff"

export const MCP_SCOPE_META: Record<
  McpScope,
  { title: string; description: string }
> = {
  search: {
    title: "Search listings",
    description: "Find boards, live listings, and sold-price comps.",
  },
  "cart:read": {
    title: "See your cart",
    description: "Read the boards in your cart and their listing prices.",
  },
  "cart:write": {
    title: "Change your cart",
    description: "Add and remove boards in your cart.",
  },
  checkout: {
    title: "Start checkout",
    description:
      "Create a checkout link for you to open. The assistant cannot charge your card. You pay on Reswell.",
  },
  "catalog:read": {
    title: "Read brand catalog",
    description: "List and inspect brands and board models in the Reswell catalog.",
  },
  "catalog:write": {
    title: "Edit brand catalog",
    description: "Create and update brands and models. Changes go live on the site.",
  },
  "blog:read": {
    title: "Read blog posts",
    description: "List and inspect Reswell blog drafts and published posts.",
  },
  "blog:write": {
    title: "Edit and publish blog",
    description:
      "Create, update, publish, and hide blog posts. Published posts go live without a deploy.",
  },
}

export type McpOAuthClientRow = {
  client_id: string
  client_secret_hash: string | null
  client_name: string
  redirect_uris: string[]
  grant_types: string[]
  response_types: string[]
  token_endpoint_auth_method: string
  created_at: string
}

export type McpOAuthTokenRow = {
  id: string
  access_token_hash: string
  refresh_token_hash: string | null
  client_id: string
  user_id: string
  scopes: string[]
  resource: string
  access_expires_at: string
  refresh_expires_at: string | null
  revoked_at: string | null
  created_at: string
  last_used_at: string | null
}

export type McpAccessPrincipal = {
  tokenId: string
  userId: string
  clientId: string
  scopes: McpScope[]
  resource: string
}

export type McpJsonRpcId = string | number | null

export type McpJsonRpcRequest = {
  jsonrpc: "2.0"
  id?: McpJsonRpcId
  method: string
  params?: unknown
}

export type McpJsonRpcSuccess = {
  jsonrpc: "2.0"
  id: McpJsonRpcId
  result: unknown
}

export type McpJsonRpcFailure = {
  jsonrpc: "2.0"
  id: McpJsonRpcId
  error: { code: number; message: string; data?: unknown }
}

export type McpToolDefinition = {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  requiredScope: McpScope
  /** When true, tools/list includes MCP Apps / ChatGPT widget _meta. */
  ui?: boolean
  annotations?: {
    readOnlyHint?: boolean
    openWorldHint?: boolean
    destructiveHint?: boolean
  }
}

export type McpToolCallResult = {
  content: Array<
    | { type: "text"; text: string }
    | {
        type: "resource_link"
        uri: string
        name: string
        title?: string
        mimeType?: string
      }
  >
  structuredContent?: Record<string, unknown>
  _meta?: Record<string, unknown>
  isError?: boolean
}

export type McpConnectionSummary = {
  tokenId: string
  clientId: string
  clientName: string
  scopes: McpScope[]
  createdAt: string
  lastUsedAt: string | null
  accessExpiresAt: string
  refreshExpiresAt: string | null
}
