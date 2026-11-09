import {
  authenticateStaffMcpBearerToken,
  bearerTokenFromAuthorizationHeader,
} from "@/lib/services/mcpAuth"
import {
  MCP_PROTOCOL_VERSION,
  isMcpEnabled,
  staffMcpWwwAuthenticateHeader,
} from "@/lib/services/mcpConfig"
import {
  listStaffMcpToolsForPrincipal,
  STAFF_MCP_INSTRUCTIONS,
} from "@/lib/services/staffMcpToolCatalog"
import type {
  McpAccessPrincipal,
  McpJsonRpcFailure,
  McpJsonRpcId,
  McpJsonRpcRequest,
  McpJsonRpcSuccess,
} from "@/lib/types/mcp"
import type { McpHttpResult } from "@/lib/services/mcpServer"

function success(id: McpJsonRpcId, result: unknown): McpJsonRpcSuccess {
  return { jsonrpc: "2.0", id, result }
}

function failure(
  id: McpJsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): McpJsonRpcFailure {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  }
}

function isJsonRpcRequest(value: unknown): value is McpJsonRpcRequest {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return obj.jsonrpc === "2.0" && typeof obj.method === "string"
}

async function handleStaffMcpMethod(
  principal: McpAccessPrincipal,
  request: McpJsonRpcRequest,
): Promise<McpJsonRpcSuccess | McpJsonRpcFailure | null> {
  const id = request.id ?? null
  const isNotification = request.id === undefined

  switch (request.method) {
    case "initialize": {
      if (isNotification) return null
      const params =
        request.params && typeof request.params === "object"
          ? (request.params as { protocolVersion?: string })
          : {}
      const requested = params.protocolVersion?.trim() || MCP_PROTOCOL_VERSION
      return success(id, {
        protocolVersion: requested === MCP_PROTOCOL_VERSION ? requested : MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: "reswell-staff-mcp",
          title: "Reswell Staff",
          version: "1.0.0",
        },
        instructions: STAFF_MCP_INSTRUCTIONS,
      })
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return null
    case "ping": {
      if (isNotification) return null
      return success(id, {})
    }
    case "tools/list": {
      if (isNotification) return null
      return success(id, {
        tools: listStaffMcpToolsForPrincipal(principal),
      })
    }
    case "tools/call": {
      if (isNotification) return null
      const params =
        request.params && typeof request.params === "object"
          ? (request.params as { name?: string; arguments?: unknown })
          : {}
      if (!params.name?.trim()) {
        return failure(id, -32602, "tools/call requires params.name")
      }
      const { callStaffMcpToolService } = await import("@/lib/services/staffMcpTools")
      const result = await callStaffMcpToolService(
        principal,
        params.name.trim(),
        params.arguments ?? {},
      )
      return success(id, result)
    }
    case "resources/list": {
      if (isNotification) return null
      return success(id, { resources: [] })
    }
    case "resources/templates/list": {
      if (isNotification) return null
      return success(id, { resourceTemplates: [] })
    }
    default: {
      if (isNotification) return null
      return failure(id, -32601, `Method not found: ${request.method}`)
    }
  }
}

export async function handleStaffMcpHttpRequest(input: {
  method: string
  authorizationHeader: string | null
  body: unknown
}): Promise<McpHttpResult> {
  if (!isMcpEnabled()) {
    return {
      kind: "json",
      status: 503,
      body: { error: "Reswell MCP is temporarily disabled" },
    }
  }

  if (input.method === "GET" || input.method === "DELETE") {
    return {
      kind: "json",
      status: 405,
      body: { error: "Use POST for MCP JSON-RPC" },
    }
  }

  const bearer = bearerTokenFromAuthorizationHeader(input.authorizationHeader)
  if (!bearer) {
    return {
      kind: "unauthorized",
      wwwAuthenticate: staffMcpWwwAuthenticateHeader(
        "invalid_token",
        "Authentication required",
      ),
      body: {
        error: "invalid_token",
        error_description: "Authentication required",
      },
    }
  }

  const auth = await authenticateStaffMcpBearerToken(bearer)
  if (!auth.ok) {
    if (auth.error === "insufficient_scope") {
      return {
        kind: "forbidden",
        body: {
          error: auth.error,
          error_description: auth.description,
        },
      }
    }
    return {
      kind: "unauthorized",
      wwwAuthenticate: staffMcpWwwAuthenticateHeader(auth.error, auth.description),
      body: {
        error: auth.error,
        error_description: auth.description,
      },
    }
  }

  if (input.body == null) {
    return {
      kind: "json",
      status: 400,
      body: failure(null, -32700, "Parse error: empty body"),
    }
  }

  if (Array.isArray(input.body)) {
    const responses: Array<McpJsonRpcSuccess | McpJsonRpcFailure> = []
    for (const item of input.body) {
      if (!isJsonRpcRequest(item)) {
        responses.push(failure(null, -32600, "Invalid Request"))
        continue
      }
      const handled = await handleStaffMcpMethod(auth.principal, item)
      if (handled) responses.push(handled)
    }
    if (responses.length === 0) return { kind: "no_content" }
    return { kind: "json", status: 200, body: responses }
  }

  if (!isJsonRpcRequest(input.body)) {
    return {
      kind: "json",
      status: 400,
      body: failure(null, -32600, "Invalid Request"),
    }
  }

  const handled = await handleStaffMcpMethod(auth.principal, input.body)
  if (!handled) return { kind: "no_content" }
  return { kind: "json", status: 200, body: handled }
}
