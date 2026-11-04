import { getDb } from "@/lib/supabase/db"
import { dbGetMcpTokenByAccessHash, dbTouchMcpTokenLastUsed } from "@/lib/db/mcpOAuth"
import {
  mcpResourceMatches,
  mcpResourceUrl,
  parseShopperMcpScopes,
  parseStaffMcpScopes,
  staffMcpResourceUrl,
} from "@/lib/services/mcpConfig"
import { mcpHashSecret } from "@/lib/services/mcpCrypto"
import type { McpAccessPrincipal, McpScope } from "@/lib/types/mcp"

export function bearerTokenFromAuthorizationHeader(
  header: string | null,
): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

export async function authenticateMcpBearerToken(
  accessToken: string,
  options?: { expectedResource?: string; kind?: "shopper" | "staff" },
): Promise<
  | { ok: true; principal: McpAccessPrincipal }
  | { ok: false; error: "invalid_token" | "insufficient_scope"; description: string }
> {
  const expectedResource = options?.expectedResource ?? mcpResourceUrl()
  const kind = options?.kind ?? "shopper"
  const supabase = getDb({ consistency: "strong", purpose: "analytics" })
  const row = await dbGetMcpTokenByAccessHash(supabase, mcpHashSecret(accessToken))
  if (!row || row.revoked_at) {
    return {
      ok: false,
      error: "invalid_token",
      description: "Access token is invalid or has been revoked",
    }
  }
  if (new Date(row.access_expires_at).getTime() <= Date.now()) {
    return {
      ok: false,
      error: "invalid_token",
      description: "Access token expired",
    }
  }
  if (!mcpResourceMatches(row.resource, expectedResource)) {
    return {
      ok: false,
      error: "invalid_token",
      description: "Access token audience mismatch",
    }
  }

  const scopes =
    kind === "staff"
      ? parseStaffMcpScopes(row.scopes.join(" "))
      : parseShopperMcpScopes(row.scopes.join(" "))
  if (scopes.length === 0) {
    return {
      ok: false,
      error: "insufficient_scope",
      description: "Access token has no usable scopes",
    }
  }

  void dbTouchMcpTokenLastUsed(supabase, row.id)

  return {
    ok: true,
    principal: {
      tokenId: row.id,
      userId: row.user_id,
      clientId: row.client_id,
      scopes: [...scopes],
      resource: row.resource,
    },
  }
}

export async function authenticateStaffMcpBearerToken(
  accessToken: string,
): Promise<
  | { ok: true; principal: McpAccessPrincipal }
  | { ok: false; error: "invalid_token" | "insufficient_scope"; description: string }
> {
  return authenticateMcpBearerToken(accessToken, {
    expectedResource: staffMcpResourceUrl(),
    kind: "staff",
  })
}

export function principalHasScope(
  principal: McpAccessPrincipal,
  scope: McpScope,
): boolean {
  return principal.scopes.includes(scope)
}

/** Confirm the token owner is still marketplace staff before tool calls. */
export async function assertStaffMcpPrincipalActive(
  userId: string,
): Promise<{ ok: true; isAdmin: boolean } | { ok: false; error: string }> {
  const supabase = getDb({ consistency: "strong", purpose: "analytics" })
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", userId)
    .maybeSingle()
  if (error) {
    console.error("[staff-mcp] profile lookup failed", {
      userId,
      timestamp: new Date().toISOString(),
      message: error.message,
    })
    return { ok: false, error: "Could not verify staff access" }
  }
  const isAdmin = data?.is_admin === true
  const isEmployee = data?.is_employee === true
  if (!isAdmin && !isEmployee) {
    return { ok: false, error: "This account is no longer authorized for staff MCP" }
  }
  return { ok: true, isAdmin }
}
