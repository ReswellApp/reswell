import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/supabase/db"
import { dbRevokeMcpTokensByRefreshHash, dbGetMcpTokenByAccessHash } from "@/lib/db/mcpOAuth"
import { mcpHashSecret } from "@/lib/services/mcpCrypto"

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

/**
 * RFC 7009-style revoke. Always returns 200 so clients can forget the token.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    let token = ""
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as { token?: string }
      token = json.token?.trim() ?? ""
    } else {
      const params = new URLSearchParams(await request.text())
      token = params.get("token")?.trim() ?? ""
    }
    if (!token) {
      return new NextResponse(null, { status: 200, headers: corsHeaders() })
    }

    const supabase = getDb({ consistency: "strong", purpose: "analytics" })
    const hash = mcpHashSecret(token)
    if (token.startsWith("rw_rt_")) {
      await dbRevokeMcpTokensByRefreshHash(supabase, hash)
    } else {
      const row = await dbGetMcpTokenByAccessHash(supabase, hash)
      if (row?.refresh_token_hash) {
        await dbRevokeMcpTokensByRefreshHash(supabase, row.refresh_token_hash)
      } else if (row) {
        await supabase
          .from("mcp_oauth_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", row.id)
      }
    }

    return new NextResponse(null, { status: 200, headers: corsHeaders() })
  } catch (error) {
    console.error("[mcp-oauth] revoke failed", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return new NextResponse(null, { status: 200, headers: corsHeaders() })
  }
}
