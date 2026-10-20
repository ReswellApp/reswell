import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  McpOAuthClientRow,
  McpOAuthTokenRow,
  McpScope,
} from "@/lib/types/mcp"

export async function dbInsertMcpOAuthClient(
  supabase: SupabaseClient,
  input: {
    clientId: string
    clientSecretHash: string | null
    clientName: string
    redirectUris: string[]
    grantTypes: string[]
    responseTypes: string[]
    tokenEndpointAuthMethod: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("mcp_oauth_clients").insert({
    client_id: input.clientId,
    client_secret_hash: input.clientSecretHash,
    client_name: input.clientName,
    redirect_uris: input.redirectUris,
    grant_types: input.grantTypes,
    response_types: input.responseTypes,
    token_endpoint_auth_method: input.tokenEndpointAuthMethod,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function dbGetMcpOAuthClient(
  supabase: SupabaseClient,
  clientId: string,
): Promise<McpOAuthClientRow | null> {
  const { data, error } = await supabase
    .from("mcp_oauth_clients")
    .select(
      "client_id, client_secret_hash, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method, created_at",
    )
    .eq("client_id", clientId)
    .maybeSingle()
  if (error || !data) return null
  return data as McpOAuthClientRow
}

export async function dbInsertMcpAuthorizationCode(
  supabase: SupabaseClient,
  input: {
    codeHash: string
    clientId: string
    userId: string
    redirectUri: string
    scopes: McpScope[]
    codeChallenge: string
    codeChallengeMethod: "S256"
    resource: string
    expiresAt: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("mcp_oauth_authorization_codes").insert({
    code_hash: input.codeHash,
    client_id: input.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    scopes: input.scopes,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    resource: input.resource,
    expires_at: input.expiresAt,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export type McpAuthorizationCodeRow = {
  code_hash: string
  client_id: string
  user_id: string
  redirect_uri: string
  scopes: string[]
  code_challenge: string
  code_challenge_method: string
  resource: string
  expires_at: string
  used_at: string | null
}

export async function dbConsumeMcpAuthorizationCode(
  supabase: SupabaseClient,
  codeHash: string,
): Promise<McpAuthorizationCodeRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("mcp_oauth_authorization_codes")
    .update({ used_at: now })
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", now)
    .select(
      "code_hash, client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, resource, expires_at, used_at",
    )
    .maybeSingle()
  if (error || !data) return null
  return data as McpAuthorizationCodeRow
}

export async function dbInsertMcpOAuthToken(
  supabase: SupabaseClient,
  input: {
    accessTokenHash: string
    refreshTokenHash: string
    clientId: string
    userId: string
    scopes: McpScope[]
    resource: string
    accessExpiresAt: string
    refreshExpiresAt: string
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("mcp_oauth_tokens")
    .insert({
      access_token_hash: input.accessTokenHash,
      refresh_token_hash: input.refreshTokenHash,
      client_id: input.clientId,
      user_id: input.userId,
      scopes: input.scopes,
      resource: input.resource,
      access_expires_at: input.accessExpiresAt,
      refresh_expires_at: input.refreshExpiresAt,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" }
  return { ok: true, id: (data as { id: string }).id }
}

export async function dbGetMcpTokenByAccessHash(
  supabase: SupabaseClient,
  accessTokenHash: string,
): Promise<McpOAuthTokenRow | null> {
  const { data, error } = await supabase
    .from("mcp_oauth_tokens")
    .select(
      "id, access_token_hash, refresh_token_hash, client_id, user_id, scopes, resource, access_expires_at, refresh_expires_at, revoked_at, created_at, last_used_at",
    )
    .eq("access_token_hash", accessTokenHash)
    .maybeSingle()
  if (error || !data) return null
  return data as McpOAuthTokenRow
}

export async function dbGetMcpTokenByRefreshHash(
  supabase: SupabaseClient,
  refreshTokenHash: string,
): Promise<McpOAuthTokenRow | null> {
  const { data, error } = await supabase
    .from("mcp_oauth_tokens")
    .select(
      "id, access_token_hash, refresh_token_hash, client_id, user_id, scopes, resource, access_expires_at, refresh_expires_at, revoked_at, created_at, last_used_at",
    )
    .eq("refresh_token_hash", refreshTokenHash)
    .maybeSingle()
  if (error || !data) return null
  return data as McpOAuthTokenRow
}

export async function dbRotateMcpOAuthToken(
  supabase: SupabaseClient,
  tokenId: string,
  input: {
    accessTokenHash: string
    refreshTokenHash: string
    accessExpiresAt: string
    refreshExpiresAt: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("mcp_oauth_tokens")
    .update({
      access_token_hash: input.accessTokenHash,
      refresh_token_hash: input.refreshTokenHash,
      access_expires_at: input.accessExpiresAt,
      refresh_expires_at: input.refreshExpiresAt,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", tokenId)
    .is("revoked_at", null)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function dbTouchMcpTokenLastUsed(
  supabase: SupabaseClient,
  tokenId: string,
): Promise<void> {
  await supabase
    .from("mcp_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenId)
    .is("revoked_at", null)
}

export async function dbRevokeMcpTokenForUser(
  supabase: SupabaseClient,
  tokenId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error, count } = await supabase
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", tokenId)
    .eq("user_id", userId)
    .is("revoked_at", null)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: "Connection not found" }
  return { ok: true }
}

export async function dbRevokeMcpTokensByRefreshHash(
  supabase: SupabaseClient,
  refreshTokenHash: string,
): Promise<void> {
  await supabase
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("refresh_token_hash", refreshTokenHash)
    .is("revoked_at", null)
}

export type McpConnectionJoinRow = {
  id: string
  client_id: string
  scopes: string[]
  created_at: string
  last_used_at: string | null
  access_expires_at: string
  refresh_expires_at: string | null
  mcp_oauth_clients: { client_name: string } | { client_name: string }[] | null
}

export async function dbListMcpConnectionsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<McpConnectionJoinRow[]> {
  const { data, error } = await supabase
    .from("mcp_oauth_tokens")
    .select(
      `
      id,
      client_id,
      scopes,
      created_at,
      last_used_at,
      access_expires_at,
      refresh_expires_at,
      mcp_oauth_clients ( client_name )
    `,
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data as McpConnectionJoinRow[]
}

export async function dbGetProfileEmail(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle()
  if (error || !data) return null
  const email = (data as { email?: string | null }).email
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null
}
