"use client"

import { useState, useTransition } from "react"
import { decideMcpOAuthConsentAction } from "@/lib/actions/mcpOAuthActions"
import { Button } from "@/components/ui/button"
import { MCP_SCOPE_META, type McpScope } from "@/lib/types/mcp"
import { cn } from "@/lib/utils"

type OAuthConsentFormProps = {
  clientName: string
  userEmail: string
  clientId: string
  redirectUri: string
  scope: string
  state?: string
  codeChallenge: string
  resource: string
  requestedScopes: McpScope[]
}

export function OAuthConsentForm({
  clientName,
  userEmail,
  clientId,
  redirectUri,
  scope,
  state,
  codeChallenge,
  resource,
  requestedScopes,
}: OAuthConsentFormProps) {
  const [selected, setSelected] = useState<McpScope[]>(requestedScopes)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleScope(scopeName: McpScope) {
    setSelected((prev) =>
      prev.includes(scopeName)
        ? prev.filter((s) => s !== scopeName)
        : [...prev, scopeName],
    )
  }

  function submit(decision: "approve" | "deny") {
    setError(null)
    const formData = new FormData()
    formData.set("client_id", clientId)
    formData.set("redirect_uri", redirectUri)
    formData.set("scope", scope)
    if (state) formData.set("state", state)
    formData.set("code_challenge", codeChallenge)
    formData.set("code_challenge_method", "S256")
    formData.set("resource", resource)
    formData.set("decision", decision)
    for (const s of selected) formData.append("approved_scopes", s)

    startTransition(async () => {
      const result = await decideMcpOAuthConsentAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <div className="space-y-6 border border-border bg-background p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Sign in with Reswell
          </p>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Connect {clientName}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground">{clientName}</span> wants to use your
            Reswell account ({userEmail}). You can disconnect it later. The sign-in
            code will be sent back to the assistant.
          </p>
        </div>

        <ul className="space-y-3">
          {requestedScopes.map((scopeName) => {
            const meta = MCP_SCOPE_META[scopeName]
            const checked = selected.includes(scopeName)
            return (
              <li key={scopeName}>
                <label
                  className={cn(
                    "flex cursor-pointer gap-3 border border-border px-3 py-3 transition-colors",
                    checked ? "bg-muted/40" : "bg-background",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-foreground"
                    checked={checked}
                    onChange={() => toggleScope(scopeName)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {meta.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {meta.description}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="w-full sm:flex-1"
            disabled={pending || selected.length === 0}
            onClick={() => submit("approve")}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1"
            disabled={pending}
            onClick={() => submit("deny")}
          >
            Deny
          </Button>
        </div>
      </div>
    </div>
  )
}
