import { MCP_UI_EXTENSION_ID, MCP_UI_MIME } from "@/lib/mcp-widgets/constants"
import { listMcpUiResources, readMcpUiResource } from "@/lib/mcp-widgets/resources"
import { withPublicMcpPhotos } from "@/lib/services/publicMcpContent"
import { MCP_PROTOCOL_VERSION } from "@/lib/services/mcpConfig"
import {
  listPublicMcpTools,
  PUBLIC_MCP_INSTRUCTIONS,
  PUBLIC_MCP_TOOL_NAMES,
} from "@/lib/services/mcpToolCatalog"
import { absoluteUrl } from "@/lib/site-metadata"
import type {
  McpAccessPrincipal,
  McpJsonRpcFailure,
  McpJsonRpcId,
  McpJsonRpcRequest,
  McpJsonRpcSuccess,
  McpToolCallResult,
} from "@/lib/types/mcp"

export type PublicMcpRateLimitResult =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; status: 429; body: unknown; headers: Record<string, string> }

export type PublicMcpHttpResult =
  | { kind: "json"; status: number; body: unknown; headers?: Record<string, string> }
  | { kind: "no_content" }
  | { kind: "rate_limited"; status: 429; body: unknown; headers: Record<string, string> }

const PUBLIC_MCP_PRINCIPAL: McpAccessPrincipal = {
  tokenId: "public",
  userId: "public",
  clientId: "public-mcp",
  scopes: ["search"],
  resource: "https://www.reswell.app/api/public/mcp",
}

function publicPrincipal(): McpAccessPrincipal {
  return {
    ...PUBLIC_MCP_PRINCIPAL,
    resource: absoluteUrl("/api/public/mcp"),
  }
}

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

function isPublicToolName(name: string): boolean {
  return (PUBLIC_MCP_TOOL_NAMES as readonly string[]).includes(name)
}

function requestIncludesToolCall(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((item) => isJsonRpcRequest(item) && item.method === "tools/call")
  }
  return isJsonRpcRequest(body) && body.method === "tools/call"
}

async function handlePublicMcpMethod(
  request: McpJsonRpcRequest,
  callTool: (
    principal: McpAccessPrincipal,
    name: string,
    args: unknown,
  ) => Promise<McpToolCallResult>,
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
          resources: { listChanged: false },
          extensions: {
            [MCP_UI_EXTENSION_ID]: {
              mimeTypes: [MCP_UI_MIME],
            },
          },
        },
        serverInfo: {
          name: "reswell-public-mcp",
          title: "Reswell listings",
          version: "1.0.0",
        },
        instructions: PUBLIC_MCP_INSTRUCTIONS,
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
      return success(id, { tools: listPublicMcpTools() })
    }
    case "tools/call": {
      if (isNotification) return null
      const params =
        request.params && typeof request.params === "object"
          ? (request.params as { name?: string; arguments?: unknown })
          : {}
      const name = params.name?.trim()
      if (!name) {
        return failure(id, -32602, "tools/call requires params.name")
      }
      if (!isPublicToolName(name)) {
        return success(id, {
          content: [
            {
              type: "text",
              text: `Tool ${name} is not on the public MCP. Cart and checkout use the signed-in MCP at /api/mcp.`,
            },
          ],
          isError: true,
        })
      }
      const result = await callTool(publicPrincipal(), name, params.arguments ?? {})
      return success(id, withPublicMcpPhotos(result))
    }
    case "resources/list": {
      if (isNotification) return null
      return success(id, { resources: listMcpUiResources() })
    }
    case "resources/read": {
      if (isNotification) return null
      const params =
        request.params && typeof request.params === "object"
          ? (request.params as { uri?: string })
          : {}
      const uri = params.uri?.trim()
      if (!uri) {
        return failure(id, -32602, "resources/read requires params.uri")
      }
      const resource = readMcpUiResource(uri)
      if (!resource) {
        return failure(id, -32002, `Resource not found: ${uri}`)
      }
      return success(id, {
        contents: [
          {
            uri: resource.uri,
            mimeType: resource.mimeType,
            text: resource.text,
            ...(resource._meta ? { _meta: resource._meta } : {}),
          },
        ],
      })
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

async function defaultCallTool(
  principal: McpAccessPrincipal,
  name: string,
  args: unknown,
): Promise<McpToolCallResult> {
  const { callMcpToolService } = await import("@/lib/services/mcpTools")
  return callMcpToolService(principal, name, args)
}

export async function handlePublicMcpHttpRequest(input: {
  method: string
  body: unknown
  consumeToolCall: () => Promise<PublicMcpRateLimitResult>
  callTool?: (
    principal: McpAccessPrincipal,
    name: string,
    args: unknown,
  ) => Promise<McpToolCallResult>
}): Promise<PublicMcpHttpResult> {
  if (input.method === "GET" || input.method === "DELETE") {
    return {
      kind: "json",
      status: 405,
      body: { error: "Use POST for MCP JSON-RPC" },
    }
  }

  if (input.body == null) {
    return {
      kind: "json",
      status: 400,
      body: failure(null, -32700, "Parse error: empty body"),
    }
  }

  if (!Array.isArray(input.body) && !isJsonRpcRequest(input.body)) {
    return {
      kind: "json",
      status: 400,
      body: failure(null, -32600, "Invalid Request"),
    }
  }

  let rateHeaders: Record<string, string> | undefined
  if (requestIncludesToolCall(input.body)) {
    const limited = await input.consumeToolCall()
    if (!limited.ok) {
      return {
        kind: "rate_limited",
        status: limited.status,
        body: limited.body,
        headers: limited.headers,
      }
    }
    rateHeaders = limited.headers
  }

  const callTool = input.callTool ?? defaultCallTool

  if (Array.isArray(input.body)) {
    const responses: Array<McpJsonRpcSuccess | McpJsonRpcFailure> = []
    for (const item of input.body) {
      if (!isJsonRpcRequest(item)) {
        responses.push(failure(null, -32600, "Invalid Request"))
        continue
      }
      const handled = await handlePublicMcpMethod(item, callTool)
      if (handled) responses.push(handled)
    }
    if (responses.length === 0) return { kind: "no_content" }
    return { kind: "json", status: 200, body: responses, headers: rateHeaders }
  }

  const handled = await handlePublicMcpMethod(input.body, callTool)
  if (!handled) return { kind: "no_content" }
  return { kind: "json", status: 200, body: handled, headers: rateHeaders }
}
