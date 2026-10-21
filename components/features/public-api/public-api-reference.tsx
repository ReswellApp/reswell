import Link from "next/link"
import { publicSiteOrigin } from "@/lib/public-site-origin"

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/public/search",
    example: "?q=channel+islands+twin+pin&type=models&limit=5",
    purpose: "Search catalog models or live listings",
  },
  {
    method: "GET",
    path: "/api/public/pricing",
    example: "?brand=channel-islands&model=twin-pin",
    purpose: "Asking prices and sold comps",
  },
  {
    method: "GET",
    path: "/api/public/listings/{id}",
    example: "/api/public/listings/{listingId}",
    purpose: "One marketplace listing, including photo URLs",
  },
] as const

function cardClassName(): string {
  return "rounded-2xl border border-border/80 bg-card p-5 sm:p-6"
}

export function PublicApiReference() {
  const origin = publicSiteOrigin()
  const curl = [
    "# Free (10 req/min)",
    `curl "${origin}/api/public/search?q=channel+islands+twin+pin&type=models&limit=5"`,
    `curl "${origin}/api/public/pricing?brand=channel-islands&model=twin-pin"`,
    `curl "${origin}/api/public/listings/{listingId}"`,
    "",
    "# Registered (30 req/min) — bearer token from a signed-in Reswell account",
    `curl -H "Authorization: Bearer $AUTH_TOKEN" \\`,
    `  "${origin}/api/public/pricing?brand=channel-islands&model=twin-pin"`,
  ].join("\n")

  return (
    <div className="space-y-6">
      <section className={cardClassName()}>
        <h2 className="font-headline text-2xl font-bold tracking-tight">Rate limits</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Limits are enforced per client. Anonymous traffic is capped by IP. Authenticated
          traffic is capped per Reswell account.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Tier</th>
                <th className="pb-3 pr-4 font-medium">Limit</th>
                <th className="pb-3 font-medium">How</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              <tr className="border-t border-border/70">
                <td className="py-3 pr-4 font-medium">Free</td>
                <td className="py-3 pr-4">10 req/min</td>
                <td className="py-3 text-muted-foreground">No auth. Per IP.</td>
              </tr>
              <tr className="border-t border-border/70">
                <td className="py-3 pr-4 font-medium">Registered</td>
                <td className="py-3 pr-4">30 req/min</td>
                <td className="py-3 text-muted-foreground">
                  Signed-in Reswell account and{" "}
                  <code className="text-foreground">Authorization: Bearer &lt;auth_token&gt;</code>
                  . Anonymous sessions stay on the free tier.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Over limit returns 429 with <code className="text-foreground">Retry-After</code>,{" "}
          <code className="text-foreground">tier</code>,{" "}
          <code className="text-foreground">limit_per_minute</code>, and a message explaining how
          to move from free to registered.
        </p>
      </section>

      <section className={cardClassName()}>
        <h2 className="font-headline text-2xl font-bold tracking-tight">Endpoints</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Method</th>
                <th className="pb-3 pr-4 font-medium">Path</th>
                <th className="pb-3 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((endpoint) => (
                <tr key={endpoint.path} className="border-t border-border/70 align-top">
                  <td className="py-3 pr-4 font-medium text-emerald-700">{endpoint.method}</td>
                  <td className="py-3 pr-4">
                    <p className="font-mono text-xs text-foreground">{endpoint.path}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{endpoint.example}</p>
                  </td>
                  <td className="py-3 text-muted-foreground">{endpoint.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Preferred flow: search, then pricing by brand and model and/or one listing id, then
          link people to the HTML URLs in <code className="text-foreground">urls</code>.
        </p>
        <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
          {curl}
        </pre>
        <p className="text-sm text-muted-foreground">
          Response shape:{" "}
          <code className="text-foreground">{`{ "success": true, "data": { ... } }`}</code>. On
          limit exceeded: 429, <code className="text-foreground">Retry-After</code>, and a JSON
          message describing the tier and upgrade path.
        </p>
      </section>

      <section className={cardClassName()}>
        <h2 className="font-headline text-2xl font-bold tracking-tight">For agents</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Machine-readable discovery lives at{" "}
          <Link href="/llms.txt" className="text-primary underline">
            /llms.txt
          </Link>{" "}
          and the OpenAPI spec at{" "}
          <Link href="/openapi.json" className="text-primary underline">
            /openapi.json
          </Link>
          . Prefer <code className="text-foreground">/api/public/*</code> over HTML{" "}
          <code className="text-foreground">/search</code>,{" "}
          <code className="text-foreground">/boards</code>, or{" "}
          <code className="text-foreground">/sold</code> scrapes.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Questions?{" "}
          <Link href="/help" className="text-primary underline">
            Help center
          </Link>
          .
        </p>
      </section>

      <section className={cardClassName()}>
        <h2 className="font-headline text-2xl font-bold tracking-tight">Connected assistants</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Claude, ChatGPT, and other MCP clients can sign in with a Reswell account. This is
          separate from the public research API. The assistant can search, edit the cart, and
          start checkout only after the buyer agrees. It cannot charge a card. Accounts that
          are not enabled are refused. Manage connections at{" "}
          <Link href="/oauth/connections" className="text-primary underline">
            /oauth/connections
          </Link>
          .           The MCP URL is <code className="text-foreground">{`${origin}/api/mcp`}</code>.
        </p>
      </section>
    </div>
  )
}
