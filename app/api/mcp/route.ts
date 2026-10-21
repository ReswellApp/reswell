import { NextRequest, NextResponse } from "next/server"
import { handleMcpHttpRequest } from "@/lib/services/mcpServer"
import { MCP_PROTOCOL_VERSION } from "@/lib/services/mcpConfig"

export const dynamic = "force-dynamic"

function mcpCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, MCP-Protocol-Version, Accept",
    "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Protocol-Version",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mcpCorsHeaders() })
}

export async function GET() {
  const result = await handleMcpHttpRequest({
    method: "GET",
    authorizationHeader: null,
    body: null,
  })
  if (result.kind === "unauthorized") {
    return NextResponse.json(result.body, {
      status: 401,
      headers: {
        ...mcpCorsHeaders(),
        "WWW-Authenticate": result.wwwAuthenticate,
      },
    })
  }
  return NextResponse.json(
    { error: "Use POST for MCP JSON-RPC" },
    { status: 405, headers: mcpCorsHeaders() },
  )
}

export async function POST(request: NextRequest) {
  let body: unknown = null
  const raw = await request.text()
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
    const result = await handleMcpHttpRequest({
      method: "POST",
      authorizationHeader: request.headers.get("authorization"),
      body,
    })

    if (result.kind === "unauthorized") {
      return NextResponse.json(result.body, {
        status: 401,
        headers: {
          ...mcpCorsHeaders(),
          "WWW-Authenticate": result.wwwAuthenticate,
        },
      })
    }
    if (result.kind === "forbidden") {
      return NextResponse.json(result.body, {
        status: 403,
        headers: mcpCorsHeaders(),
      })
    }
    if (result.kind === "no_content") {
      return new NextResponse(null, { status: 202, headers: mcpCorsHeaders() })
    }
    return NextResponse.json(result.body, {
      status: result.status,
      headers: mcpCorsHeaders(),
    })
  } catch (error) {
    console.error("[mcp] request failed", {
      route: "/api/mcp",
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
