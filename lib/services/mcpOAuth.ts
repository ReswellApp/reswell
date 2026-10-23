import { getDb } from "@/lib/supabase/db"
import {
  dbConsumeMcpAuthorizationCode,
  dbGetMcpOAuthClient,
  dbGetMcpTokenByRefreshHash,
  dbGetProfileEmail,
  dbInsertMcpAuthorizationCode,
  dbInsertMcpOAuthClient,
  dbInsertMcpOAuthToken,
  dbListMcpConnectionsForUser,
  dbRevokeMcpTokenForUser,
  dbRevokeMcpTokensByRefreshHash,
  dbRotateMcpOAuthToken,
} from "@/lib/db/mcpOAuth"
import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_AUTH_CODE_TTL_SECONDS,
  MCP_REFRESH_TOKEN_TTL_SECONDS,
  formatMcpScopes,
  isMcpEnabled,
  isMcpRedirectUriAllowed,
  mcpAllowlistEmails,
  mcpResourceMatches,
  mcpResourceUrl,
  parseMcpScopes,
} from "@/lib/services/mcpConfig"
import { mcpHashSecret, mcpPkceChallengeFromVerifier, mcpRandomToken, mcpSafeEqualHex } from "@/lib/services/mcpCrypto"
import type { McpConnectionSummary, McpOAuthClientRow, McpScope } from "@/lib/types/mcp"
import type { McpRegisterClientInput } from "@/lib/validations/mcp"

function oauthDb() {
  return getDb({ consistency: "strong", purpose: "analytics" })
}

function expiresIn(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

export function assertMcpOAuthAvailable():
  | { ok: true }
  | { ok: false; status: number; error: string } {
  if (!isMcpEnabled()) {
    return { ok: false, status: 503, error: "Reswell MCP is temporarily disabled" }
  }
  return { ok: true }
}

export async function registerMcpOAuthClientService(
  input: McpRegisterClientInput,
): Promise<
  | {
      ok: true
      data: {
        client_id: string
        client_secret?: string
        client_name: string
        redirect_uris: string[]
        grant_types: string[]
        response_types: string[]
        token_endpoint_auth_method: string
      }
    }
  | { ok: false; status: number; error: string }
> {
  const gate = assertMcpOAuthAvailable()
  if (!gate.ok) return gate

  for (const uri of input.redirect_uris) {
    if (!isMcpRedirectUriAllowed(uri)) {
      return {
        ok: false,
        status: 400,
        error: "redirect_uris must be https (or http://localhost)",
      }
    }
  }

  const authMethod = input.token_endpoint_auth_method ?? "none"
  const clientId = mcpRandomToken("rw_mcp_", 18)
  let clientSecret: string | undefined
  let clientSecretHash: string | null = null
  if (authMethod !== "none") {
    clientSecret = mcpRandomToken("rw_mcs_", 24)
    clientSecretHash = mcpHashSecret(clientSecret)
  }

  const grantTypes = input.grant_types?.length
    ? input.grant_types
    : (["authorization_code", "refresh_token"] as const)
  const responseTypes = input.response_types?.length ? input.response_types : (["code"] as const)
  const clientName = input.client_name?.trim() || "MCP client"

  const inserted = await dbInsertMcpOAuthClient(oauthDb(), {
    clientId,
    clientSecretHash,
    clientName,
    redirectUris: input.redirect_uris,
    grantTypes: [...grantTypes],
    responseTypes: [...responseTypes],
    tokenEndpointAuthMethod: authMethod,
  })
  if (!inserted.ok) {
    console.error("[mcp-oauth] register client failed", {
      timestamp: new Date().toISOString(),
      message: inserted.error,
    })
    return { ok: false, status: 500, error: "Unable to register client" }
  }

  return {
    ok: true,
    data: {
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      client_name: clientName,
      redirect_uris: input.redirect_uris,
      grant_types: [...grantTypes],
      response_types: [...responseTypes],
      token_endpoint_auth_method: authMethod,
    },
  }
}

export async function getMcpOAuthClientService(
  clientId: string,
): Promise<McpOAuthClientRow | null> {
  return dbGetMcpOAuthClient(oauthDb(), clientId)
}

export async function assertUserMayAuthorizeMcp(
  userId: string,
  emailFromSession: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowlist = mcpAllowlistEmails()
  if (!allowlist) return { ok: true }

  const sessionEmail = emailFromSession?.trim().toLowerCase() ?? null
  if (sessionEmail && allowlist.has(sessionEmail)) return { ok: true }

  const profileEmail = await dbGetProfileEmail(oauthDb(), userId)
  if (profileEmail && allowlist.has(profileEmail)) return { ok: true }

  return {
    ok: false,
    error: "This Reswell account is not on the MCP allowlist yet.",
  }
}

export function validateAuthorizeRequest(input: {
  client: McpOAuthClientRow
  redirectUri: string
  scopeRaw: string
  resource: string
}): { ok: true; scopes: McpScope[] } | { ok: false; error: string } {
  if (!input.client.redirect_uris.includes(input.redirectUri)) {
    return { ok: false, error: "redirect_uri is not registered for this client" }
  }
  if (!isMcpRedirectUriAllowed(input.redirectUri)) {
    return { ok: false, error: "redirect_uri is not allowed" }
  }
  if (!mcpResourceMatches(input.resource, mcpResourceUrl())) {
    return { ok: false, error: "resource must be the Reswell MCP URL" }
  }
  const scopes = parseMcpScopes(input.scopeRaw)
  if (scopes.length === 0) {
    return { ok: false, error: "scope must include at least one supported value" }
  }
  return { ok: true, scopes }
}

export async function issueMcpAuthorizationCodeService(input: {
  clientId: string
  userId: string
  redirectUri: string
  scopes: McpScope[]
  codeChallenge: string
  resource: string
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const code = mcpRandomToken("rw_ac_", 24)
  const inserted = await dbInsertMcpAuthorizationCode(oauthDb(), {
    codeHash: mcpHashSecret(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    scopes: input.scopes,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: "S256",
    resource: input.resource,
    expiresAt: expiresIn(MCP_AUTH_CODE_TTL_SECONDS),
  })
  if (!inserted.ok) {
    console.error("[mcp-oauth] issue code failed", {
      timestamp: new Date().toISOString(),
      userId: input.userId,
      message: inserted.error,
    })
    return { ok: false, error: "Unable to issue authorization code" }
  }
  return { ok: true, code }
}

function clientSecretMatches(
  client: McpOAuthClientRow,
  provided: string | null | undefined,
): boolean {
  if (client.token_endpoint_auth_method === "none") {
    return !provided
  }
  if (!provided || !client.client_secret_hash) return false
  return mcpSafeEqualHex(mcpHashSecret(provided), client.client_secret_hash)
}

async function mintTokenPair(input: {
  clientId: string
  userId: string
  scopes: McpScope[]
  resource: string
}): Promise<
  | {
      ok: true
      accessToken: string
      refreshToken: string
      expiresIn: number
      scope: string
    }
  | { ok: false; error: string }
> {
  const accessToken = mcpRandomToken("rw_at_", 32)
  const refreshToken = mcpRandomToken("rw_rt_", 32)
  const inserted = await dbInsertMcpOAuthToken(oauthDb(), {
    accessTokenHash: mcpHashSecret(accessToken),
    refreshTokenHash: mcpHashSecret(refreshToken),
    clientId: input.clientId,
    userId: input.userId,
    scopes: input.scopes,
    resource: input.resource,
    accessExpiresAt: expiresIn(MCP_ACCESS_TOKEN_TTL_SECONDS),
    refreshExpiresAt: expiresIn(MCP_REFRESH_TOKEN_TTL_SECONDS),
  })
  if (!inserted.ok) {
    return { ok: false, error: inserted.error }
  }
  return {
    ok: true,
    accessToken,
    refreshToken,
    expiresIn: MCP_ACCESS_TOKEN_TTL_SECONDS,
    scope: formatMcpScopes(input.scopes),
  }
}

export async function exchangeMcpAuthorizationCodeService(input: {
  code: string
  redirectUri: string
  clientId: string
  clientSecret?: string | null
  codeVerifier: string
  resource?: string | null
}): Promise<
  | {
      ok: true
      access_token: string
      token_type: "Bearer"
      expires_in: number
      refresh_token: string
      scope: string
    }
  | { ok: false; status: number; error: string; errorDescription?: string }
> {
  const gate = assertMcpOAuthAvailable()
  if (!gate.ok) {
    return { ok: false, status: gate.status, error: "temporarily_unavailable", errorDescription: gate.error }
  }

  const client = await dbGetMcpOAuthClient(oauthDb(), input.clientId)
  if (!client) {
    return { ok: false, status: 401, error: "invalid_client" }
  }
  if (!clientSecretMatches(client, input.clientSecret)) {
    return { ok: false, status: 401, error: "invalid_client" }
  }

  const row = await dbConsumeMcpAuthorizationCode(oauthDb(), mcpHashSecret(input.code))
  if (!row) {
    return {
      ok: false,
      status: 400,
      error: "invalid_grant",
      errorDescription: "Authorization code is invalid or expired",
    }
  }
  if (row.client_id !== input.clientId || row.redirect_uri !== input.redirectUri) {
    return { ok: false, status: 400, error: "invalid_grant" }
  }
  if (mcpPkceChallengeFromVerifier(input.codeVerifier) !== row.code_challenge) {
    return {
      ok: false,
      status: 400,
      error: "invalid_grant",
      errorDescription: "PKCE verification failed",
    }
  }
  if (input.resource && !mcpResourceMatches(input.resource, row.resource)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_target",
      errorDescription: "resource does not match authorization",
    }
  }

  const scopes = parseMcpScopes(row.scopes.join(" "))
  const minted = await mintTokenPair({
    clientId: row.client_id,
    userId: row.user_id,
    scopes,
    resource: row.resource,
  })
  if (!minted.ok) {
    console.error("[mcp-oauth] token mint failed", {
      timestamp: new Date().toISOString(),
      message: minted.error,
    })
    return { ok: false, status: 500, error: "server_error" }
  }

  return {
    ok: true,
    access_token: minted.accessToken,
    token_type: "Bearer",
    expires_in: minted.expiresIn,
    refresh_token: minted.refreshToken,
    scope: minted.scope,
  }
}

export async function refreshMcpAccessTokenService(input: {
  refreshToken: string
  clientId: string
  clientSecret?: string | null
  resource?: string | null
  scope?: string | null
}): Promise<
  | {
      ok: true
      access_token: string
      token_type: "Bearer"
      expires_in: number
      refresh_token: string
      scope: string
    }
  | { ok: false; status: number; error: string; errorDescription?: string }
> {
  const gate = assertMcpOAuthAvailable()
  if (!gate.ok) {
    return { ok: false, status: gate.status, error: "temporarily_unavailable", errorDescription: gate.error }
  }

  const client = await dbGetMcpOAuthClient(oauthDb(), input.clientId)
  if (!client) {
    return { ok: false, status: 401, error: "invalid_client" }
  }
  if (!clientSecretMatches(client, input.clientSecret)) {
    return { ok: false, status: 401, error: "invalid_client" }
  }

  const existing = await dbGetMcpTokenByRefreshHash(oauthDb(), mcpHashSecret(input.refreshToken))
  if (!existing || existing.revoked_at) {
    return { ok: false, status: 400, error: "invalid_grant" }
  }
  if (existing.client_id !== input.clientId) {
    return { ok: false, status: 400, error: "invalid_grant" }
  }
  if (
    !existing.refresh_expires_at ||
    new Date(existing.refresh_expires_at).getTime() <= Date.now()
  ) {
    await dbRevokeMcpTokensByRefreshHash(oauthDb(), mcpHashSecret(input.refreshToken))
    return { ok: false, status: 400, error: "invalid_grant", errorDescription: "Refresh token expired" }
  }
  if (input.resource && !mcpResourceMatches(input.resource, existing.resource)) {
    return { ok: false, status: 400, error: "invalid_target" }
  }

  let scopes = parseMcpScopes(existing.scopes.join(" "))
  if (input.scope?.trim()) {
    const requested = parseMcpScopes(input.scope)
    if (requested.some((s) => !scopes.includes(s))) {
      return { ok: false, status: 400, error: "invalid_scope" }
    }
    scopes = requested
  }

  const accessToken = mcpRandomToken("rw_at_", 32)
  const refreshToken = mcpRandomToken("rw_rt_", 32)
  const rotated = await dbRotateMcpOAuthToken(oauthDb(), existing.id, {
    accessTokenHash: mcpHashSecret(accessToken),
    refreshTokenHash: mcpHashSecret(refreshToken),
    accessExpiresAt: expiresIn(MCP_ACCESS_TOKEN_TTL_SECONDS),
    refreshExpiresAt: expiresIn(MCP_REFRESH_TOKEN_TTL_SECONDS),
  })
  if (!rotated.ok) {
    return { ok: false, status: 500, error: "server_error" }
  }

  return {
    ok: true,
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: formatMcpScopes(scopes),
  }
}

export async function listMcpConnectionsService(
  userId: string,
): Promise<McpConnectionSummary[]> {
  const rows = await dbListMcpConnectionsForUser(oauthDb(), userId)
  return rows.map((row) => {
    const clientJoin = row.mcp_oauth_clients
    const clientName = Array.isArray(clientJoin)
      ? clientJoin[0]?.client_name
      : clientJoin?.client_name
    return {
      tokenId: row.id,
      clientId: row.client_id,
      clientName: clientName?.trim() || "MCP client",
      scopes: parseMcpScopes(row.scopes.join(" ")),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      accessExpiresAt: row.access_expires_at,
      refreshExpiresAt: row.refresh_expires_at,
    }
  })
}

export async function revokeMcpConnectionService(
  userId: string,
  tokenId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return dbRevokeMcpTokenForUser(oauthDb(), tokenId, userId)
}
