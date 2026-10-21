export const MCP_SCOPES = [
  "search",
  "cart:read",
  "cart:write",
  "checkout",
] as const

export type McpScope = (typeof MCP_SCOPES)[number]

export const MCP_SCOPE_META: Record<
  McpScope,
  { title: string; description: string }
> = {
  search: {
    title: "Search listings",
    description: "Find titles, live listings, and sold-price comps.",
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
  content: Array<{ type: "text"; text: string }>
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
