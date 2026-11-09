import { NextRequest, NextResponse } from "next/server"
import { registerMcpOAuthClientService } from "@/lib/services/mcpOAuth"
import { mcpRegisterClientSchema } from "@/lib/validations/mcp"

export const dynamic = "force-dynamic"

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  try {
    const json = (await request.json()) as unknown
    const parsed = mcpRegisterClientSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_client_metadata", error_description: parsed.error.message },
        { status: 400, headers: corsHeaders() },
      )
    }

    const result = await registerMcpOAuthClientService(parsed.data)
    if (!result.ok) {
      return NextResponse.json(
        { error: "invalid_client_metadata", error_description: result.error },
        { status: result.status, headers: corsHeaders() },
      )
    }

    return NextResponse.json(result.data, {
      status: 201,
      headers: corsHeaders(),
    })
  } catch (error) {
    console.error("[mcp-oauth] register failed", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: corsHeaders() },
    )
  }
}
