import { NextRequest, NextResponse } from "next/server"
import { MCP_PROTOCOL_VERSION } from "@/lib/services/mcpConfig"
import { handlePublicMcpHttpRequest } from "@/lib/services/publicMcpServer"
import {
  enforcePublicApiGuard,
  publicApiRateLimitHeaders,
} from "@/lib/services/publicApiGuard"

export const dynamic = "force-dynamic"

const MAX_BODY_CHARS = 64_000

function mcpCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, MCP-Protocol-Version, Accept",
    "Access-Control-Expose-Headers": "MCP-Protocol-Version, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Tier",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mcpCorsHeaders() })
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST for MCP JSON-RPC" },
    { status: 405, headers: mcpCorsHeaders() },
  )
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (raw.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: body too large" },
      },
      { status: 400, headers: mcpCorsHeaders() },
    )
  }

  let body: unknown = null
  if (raw.trim()) {
    try {
      body = JSON.parse(raw) as unknown
    } catch {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        { status: 400, headers: mcpCorsHeaders() },
      )
    }
  }

  try {
    const result = await handlePublicMcpHttpRequest({
      method: "POST",
      body,
      consumeToolCall: async () => {
        const guard = await enforcePublicApiGuard(request)
        if (!guard.ok) {
          return {
            ok: false,
            status: 429,
            body: guard.body,
            headers: { "Retry-After": String(guard.retryAfter) },
          }
        }
        return { ok: true, headers: publicApiRateLimitHeaders(guard) }
      },
    })

    if (result.kind === "no_content") {
      return new NextResponse(null, { status: 202, headers: mcpCorsHeaders() })
    }
    if (result.kind === "rate_limited") {
      return NextResponse.json(result.body, {
        status: result.status,
        headers: { ...mcpCorsHeaders(), ...result.headers },
      })
    }
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { ...mcpCorsHeaders(), ...result.headers },
    })
  } catch (error) {
    console.error("[public-mcp] request failed", {
      route: "/api/public/mcp",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: "Internal error" },
      },
      { status: 500, headers: mcpCorsHeaders() },
    )
  }
}
