import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OAuthConsentForm } from "@/components/features/mcp/oauth-consent-form"
import {
  assertUserMayAuthorizeMcp,
  getMcpOAuthClientService,
  validateAuthorizeRequest,
} from "@/lib/services/mcpOAuth"
import { mcpAuthorizeQuerySchema } from "@/lib/validations/mcp"
import { privatePageMetadata } from "@/lib/site-metadata"
import { mcpResourceUrl } from "@/lib/services/mcpConfig"

export const metadata = privatePageMetadata({
  title: "Sign in with Reswell",
  description: "Approve an AI assistant to shop on Reswell with your account.",
  path: "/oauth/authorize",
})

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function McpOAuthAuthorizePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const parsed = mcpAuthorizeQuerySchema.safeParse({
    response_type: first(sp.response_type),
    client_id: first(sp.client_id),
    redirect_uri: first(sp.redirect_uri),
    scope: first(sp.scope),
    state: first(sp.state),
    code_challenge: first(sp.code_challenge),
    code_challenge_method: first(sp.code_challenge_method),
    resource: first(sp.resource) || mcpResourceUrl(),
  })

  if (!parsed.success) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Invalid authorization request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The assistant sent an incomplete OAuth request. Ask it to reconnect to{" "}
          {mcpResourceUrl()}.
        </p>
      </main>
    )
  }

  const query = parsed.data
  const client = await getMcpOAuthClientService(query.client_id)
  if (!client) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Unknown client</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This assistant is not registered with Reswell. Ask it to register again.
        </p>
      </main>
    )
  }

  const validated = validateAuthorizeRequest({
    client,
    redirectUri: query.redirect_uri,
    scopeRaw: query.scope,
    resource: query.resource,
  })
  if (!validated.ok) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Cannot authorize</h1>
        <p className="mt-2 text-sm text-muted-foreground">{validated.error}</p>
      </main>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const returnTo = `/oauth/authorize?${new URLSearchParams({
      response_type: query.response_type,
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      scope: query.scope,
      ...(query.state ? { state: query.state } : {}),
      code_challenge: query.code_challenge,
      code_challenge_method: query.code_challenge_method,
      resource: query.resource,
    }).toString()}`
    redirect(`/auth/login?redirect=${encodeURIComponent(returnTo)}`)
  }

  const allow = await assertUserMayAuthorizeMcp(user.id, user.email)
  if (!allow.ok) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium">Not available for this account</h1>
        <p className="mt-2 text-sm text-muted-foreground">{allow.error}</p>
      </main>
    )
  }

  return (
    <main>
      <OAuthConsentForm
        clientName={client.client_name}
        userEmail={user.email ?? user.id}
        clientId={query.client_id}
        redirectUri={query.redirect_uri}
        scope={query.scope}
        state={query.state}
        codeChallenge={query.code_challenge}
        resource={query.resource}
        requestedScopes={validated.scopes}
      />
    </main>
  )
}
