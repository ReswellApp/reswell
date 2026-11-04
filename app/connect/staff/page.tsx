import Link from "next/link"
import { ConnectServerUrl } from "@/components/features/mcp/connect-server-url"
import {
  staffMcpProtectedResourceMetadataUrl,
  staffMcpResourceUrl,
  mcpAuthorizationServerMetadataUrl,
} from "@/lib/services/mcpConfig"
import { MCP_SCOPE_META, MCP_STAFF_SCOPES } from "@/lib/types/mcp"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Staff MCP — Reswell",
  description:
    "Connect Claude to Reswell staff tools for brands, models, and the blog CMS. Writes go live without a deploy.",
  path: "/connect/staff",
})

const cardClassName =
  "rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-6"

export default function StaffConnectPage() {
  const serverUrl = staffMcpResourceUrl()

  return (
    <main className="flex-1 bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Internal
        </p>
        <h1 className="mt-2 font-headline text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Staff MCP
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Connect Claude (or another remote MCP client) as a Reswell admin or
          employee. Approve catalog and blog permissions once. Tools write
          straight to production — no git commit required. Disconnect anytime
          at{" "}
          <Link href="/oauth/connections" className="text-primary underline">
            Connected apps
          </Link>
          .
        </p>

        <section className={`${cardClassName} mt-8`}>
          <h2 className="font-headline text-xl font-bold tracking-tight">Server URL</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Paste this into Claude&apos;s custom connector / MCP settings. It will
            open Reswell so you can approve access. This is not the shopper MCP
            at{" "}
            <Link href="/connect" className="text-primary underline">
              /connect
            </Link>
            .
          </p>
          <ConnectServerUrl url={serverUrl} className="mt-4" />
          <p className="mt-3 text-sm text-muted-foreground">
            Discovery:{" "}
            <a href={mcpAuthorizationServerMetadataUrl()} className="text-primary underline">
              OAuth server
            </a>
            {" · "}
            <a href={staffMcpProtectedResourceMetadataUrl()} className="text-primary underline">
              protected resource
            </a>
          </p>
        </section>

        <section className={`${cardClassName} mt-4`}>
          <h2 className="font-headline text-xl font-bold tracking-tight">Permissions</h2>
          <ul className="mt-4 space-y-4">
            {MCP_STAFF_SCOPES.map((scope) => {
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
        </section>

        <section className={`${cardClassName} mt-4`}>
          <h2 className="font-headline text-xl font-bold tracking-tight">How to use</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Use a Reswell account with admin or employee access.</li>
            <li>Add the server URL in Claude as a remote MCP / custom connector.</li>
            <li>Sign in and approve catalog and/or blog scopes.</li>
            <li>
              Ask Claude to draft blog posts or add brands/models. Published content
              and catalog rows show on the site after revalidation.
            </li>
          </ol>
        </section>
      </div>
    </main>
  )
}
