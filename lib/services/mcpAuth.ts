import { getDb } from "@/lib/supabase/db"
import { dbGetMcpTokenByAccessHash, dbTouchMcpTokenLastUsed } from "@/lib/db/mcpOAuth"
import {
  mcpResourceMatches,
  mcpResourceUrl,
  parseMcpScopes,
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
): Promise<
  | { ok: true; principal: McpAccessPrincipal }
  | { ok: false; error: "invalid_token" | "insufficient_scope"; description: string }
> {
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
  if (!mcpResourceMatches(row.resource, mcpResourceUrl())) {
    return {
      ok: false,
      error: "invalid_token",
      description: "Access token audience mismatch",
    }
  }

  const scopes = parseMcpScopes(row.scopes.join(" "))
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
      scopes,
      resource: row.resource,
    },
  }
}

export function principalHasScope(
  principal: McpAccessPrincipal,
  scope: McpScope,
): boolean {
  return principal.scopes.includes(scope)
}
