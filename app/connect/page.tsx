import Link from "next/link"
import { ConnectServerUrl } from "@/components/features/mcp/connect-server-url"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import {
  mcpAuthorizationServerMetadataUrl,
  mcpProtectedResourceMetadataUrl,
  mcpResourceUrl,
} from "@/lib/services/mcpConfig"
import { MCP_SCOPE_META, MCP_SCOPES } from "@/lib/types/mcp"

export const revalidate = 86400

export async function generateMetadata() {
  return resolvePageMetadata("connect")
}

const cardClassName =
  "rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-6"

export default function ConnectPage() {
  const serverUrl = mcpResourceUrl()

  return (
    <main className="flex-1 bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
        <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Sign in with Reswell
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Connect Claude, ChatGPT, Grok, or any assistant that supports a remote MCP
          server. Reswell has to enable your account first. You approve the assistant
          once. After that it uses a token limited to the permissions you checked. You
          can disconnect it whenever you want.
        </p>

        <section className={`${cardClassName} mt-8`}>
          <h2 className="font-headline text-xl font-bold tracking-tight">Server URL</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Paste this into the assistant&apos;s custom connector or MCP settings. It will
            open Reswell so you can approve access.
          </p>
          <ConnectServerUrl url={serverUrl} className="mt-4" />
          <p className="mt-3 text-sm text-muted-foreground">
            Discovery:{" "}
            <a href={mcpAuthorizationServerMetadataUrl()} className="text-primary underline">
              OAuth server
            </a>
            {" · "}
            <a href={mcpProtectedResourceMetadataUrl()} className="text-primary underline">
              protected resource
            </a>
          </p>
        </section>

        <section className={`${cardClassName} mt-4`}>
          <h2 className="font-headline text-xl font-bold tracking-tight">What you can allow</h2>
          <ul className="mt-4 space-y-4">
            {MCP_SCOPES.map((scope) => {
              const meta = MCP_SCOPE_META[scope]
              return (
                <li key={scope}>
                  <p className="text-sm font-semibold text-foreground">{meta.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {meta.description}
                  </p>
                </li>
              )
            })}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Purchases still happen on Reswell. The assistant can build your cart and hand
            you a checkout link. It cannot charge your card. Disconnect anytime at{" "}
            <Link href="/oauth/connections" className="text-primary underline">
              Connected apps
            </Link>
            .
          </p>
        </section>

        <section className={`${cardClassName} mt-4`}>
          <h2 className="font-headline text-xl font-bold tracking-tight">
            Research without an account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Search, sold-price comps, and listing detail stay on the public API. No
            sign-in required.{" "}
            <Link href="/public-api" className="text-primary underline">
              Public API docs
            </Link>
            {" · "}
            <Link href="/llms.txt" className="text-primary underline">
              llms.txt
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
