"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  assertUserMayAuthorizeMcp,
  getMcpOAuthClientService,
  issueMcpAuthorizationCodeService,
  revokeMcpConnectionService,
  validateAuthorizeRequest,
} from "@/lib/services/mcpOAuth"
import { mcpConsentActionSchema } from "@/lib/validations/mcp"
import { parseMcpScopes } from "@/lib/services/mcpConfig"

function buildRedirect(base: string, params: Record<string, string | undefined>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value)
  }
  return url.toString()
}

export async function decideMcpOAuthConsentAction(formData: FormData) {
  const parsed = mcpConsentActionSchema.safeParse({
    client_id: formData.get("client_id"),
    redirect_uri: formData.get("redirect_uri"),
    scope: formData.get("scope"),
    state: formData.get("state") || undefined,
    code_challenge: formData.get("code_challenge"),
    code_challenge_method: formData.get("code_challenge_method"),
    resource: formData.get("resource"),
    approved_scopes: formData.getAll("approved_scopes"),
    decision: formData.get("decision"),
  })

  if (!parsed.success) {
    return { error: "Invalid consent request" }
  }

  const input = parsed.data
  const client = await getMcpOAuthClientService(input.client_id)
  if (!client) {
    return { error: "Unknown client" }
  }

  const validated = validateAuthorizeRequest({
    client,
    redirectUri: input.redirect_uri,
    scopeRaw: input.scope,
    resource: input.resource,
  })
  if (!validated.ok) {
    return { error: validated.error }
  }

  if (input.decision === "deny") {
    redirect(
      buildRedirect(input.redirect_uri, {
        error: "access_denied",
        error_description: "The user denied the request",
        state: input.state,
      }),
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Sign in required" }
  }

  const allow = await assertUserMayAuthorizeMcp(user.id, user.email)
  if (!allow.ok) {
    return { error: allow.error }
  }

  const requested = new Set(validated.scopes)
  const approved = input.approved_scopes.filter((scope) => requested.has(scope))
  if (approved.length === 0) {
    return { error: "Select at least one permission" }
  }

  // checkout implies cart read/write for a coherent shopping flow when requested
  const scopes = [...parseMcpScopes(approved.join(" "))]
  if (scopes.includes("checkout")) {
    if (requested.has("cart:read") && !scopes.includes("cart:read")) scopes.push("cart:read")
    if (requested.has("cart:write") && !scopes.includes("cart:write")) scopes.push("cart:write")
  }

  const issued = await issueMcpAuthorizationCodeService({
    clientId: input.client_id,
    userId: user.id,
    redirectUri: input.redirect_uri,
    scopes,
    codeChallenge: input.code_challenge,
    resource: input.resource,
  })
  if (!issued.ok) {
    return { error: issued.error }
  }

  redirect(
    buildRedirect(input.redirect_uri, {
      code: issued.code,
      state: input.state,
    }),
  )
}

export async function revokeMcpConnectionAction(tokenId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Sign in required" }
  }
  if (!tokenId.trim()) {
    return { error: "Missing connection id" }
  }

  const result = await revokeMcpConnectionService(user.id, tokenId.trim())
  if (!result.ok) {
    return { error: result.error }
  }
  revalidatePath("/oauth/connections")
  return { success: true as const }
}
