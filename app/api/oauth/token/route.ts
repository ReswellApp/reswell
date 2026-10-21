import { NextRequest, NextResponse } from "next/server"
import {
  exchangeMcpAuthorizationCodeService,
  refreshMcpAccessTokenService,
} from "@/lib/services/mcpOAuth"

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

function basicAuthClient(request: NextRequest): {
  clientId: string | null
  clientSecret: string | null
} {
  const header = request.headers.get("authorization")
  if (!header?.toLowerCase().startsWith("basic ")) {
    return { clientId: null, clientSecret: null }
  }
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8")
    const idx = decoded.indexOf(":")
    if (idx < 0) return { clientId: null, clientSecret: null }
    return {
      clientId: decodeURIComponent(decoded.slice(0, idx)),
      clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
    }
  } catch {
    return { clientId: null, clientSecret: null }
  }
}

async function readTokenParams(request: NextRequest): Promise<URLSearchParams> {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(json)) {
      if (value == null) continue
      params.set(key, String(value))
    }
    return params
  }
  const text = await request.text()
  return new URLSearchParams(text)
}

export async function POST(request: NextRequest) {
  try {
    const params = await readTokenParams(request)
    const basic = basicAuthClient(request)
    const grantType = params.get("grant_type")?.trim()
    const clientId = (params.get("client_id") ?? basic.clientId)?.trim()
    const clientSecret = params.get("client_secret") ?? basic.clientSecret

    if (!clientId) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "client_id is required" },
        { status: 401, headers: corsHeaders() },
      )
    }

    if (grantType === "authorization_code") {
      const code = params.get("code")?.trim()
      const redirectUri = params.get("redirect_uri")?.trim()
      const codeVerifier = params.get("code_verifier")?.trim()
      if (!code || !redirectUri || !codeVerifier) {
        return NextResponse.json(
          {
            error: "invalid_request",
            error_description: "code, redirect_uri, and code_verifier are required",
          },
          { status: 400, headers: corsHeaders() },
        )
      }

      const result = await exchangeMcpAuthorizationCodeService({
        code,
        redirectUri,
        clientId,
        clientSecret,
        codeVerifier,
        resource: params.get("resource"),
      })
      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            ...(result.errorDescription
              ? { error_description: result.errorDescription }
              : {}),
          },
          { status: result.status, headers: corsHeaders() },
        )
      }
      return NextResponse.json(
        {
          access_token: result.access_token,
          token_type: result.token_type,
          expires_in: result.expires_in,
          refresh_token: result.refresh_token,
          scope: result.scope,
        },
        { headers: corsHeaders() },
      )
    }

    if (grantType === "refresh_token") {
      const refreshToken = params.get("refresh_token")?.trim()
      if (!refreshToken) {
        return NextResponse.json(
          { error: "invalid_request", error_description: "refresh_token is required" },
          { status: 400, headers: corsHeaders() },
        )
      }
      const result = await refreshMcpAccessTokenService({
        refreshToken,
        clientId,
        clientSecret,
        resource: params.get("resource"),
        scope: params.get("scope"),
      })
      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            ...(result.errorDescription
              ? { error_description: result.errorDescription }
              : {}),
          },
          { status: result.status, headers: corsHeaders() },
        )
      }
      return NextResponse.json(
        {
          access_token: result.access_token,
          token_type: result.token_type,
          expires_in: result.expires_in,
          refresh_token: result.refresh_token,
          scope: result.scope,
        },
        { headers: corsHeaders() },
      )
    }

    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400, headers: corsHeaders() },
    )
  } catch (error) {
    console.error("[mcp-oauth] token failed", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: corsHeaders() },
    )
  }
}
