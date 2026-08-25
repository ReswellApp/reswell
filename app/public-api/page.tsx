import Link from "next/link"
import { PublicApiPlayground } from "@/components/features/public-api/public-api-playground"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const revalidate = 86400

export async function generateMetadata() {
  return resolvePageMetadata("public-api")
}

const endpoints = [
  {
    name: "Search",
    href: "/api/public/search?q=channel+islands+twin+pin&type=models&limit=5",
    detail: "GET /api/public/search?q={query}&type=models|listings&limit=5",
  },
  {
    name: "Pricing",
    href: "/api/public/pricing?brand=channel-islands&model=twin-pin",
    detail: "GET /api/public/pricing?brand={brand}&model={model}",
  },
  {
    name: "Listing",
    href: "/api/public/listings/{id}",
    detail: "GET /api/public/listings/{id} — id or slug",
  },
] as const

export default function PublicApiPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16 md:py-20">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Developers
          </p>
          <h1 className="mt-3 font-headline text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Public research API
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            Clean JSON for listings, used-board comps, and catalog search. Built for LLMs and
            research bots — use this instead of scraping HTML.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Machine-readable guides:{" "}
            <Link href="/llms.txt" className="text-primary underline">
              /llms.txt
            </Link>
            {" · "}
            <Link href="/openapi.json" className="text-primary underline">
              /openapi.json
            </Link>
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6">
        <div>
          <h2 className="font-headline text-2xl font-bold tracking-tight">Endpoints</h2>
          <ul className="mt-4 space-y-3">
            {endpoints.map((endpoint) => (
              <li key={endpoint.name} className="rounded-2xl border border-border/80 bg-card p-4">
                <p className="text-sm font-semibold text-foreground">{endpoint.name}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{endpoint.detail}</p>
                {endpoint.href.includes("{id}") ? null : (
                  <Link href={endpoint.href} className="mt-2 inline-block text-sm text-primary underline">
                    Open example
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-headline text-2xl font-bold tracking-tight">Rate limits</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Free: 10 requests / minute per IP. Signed-in or{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization: Bearer</code>{" "}
            from a Reswell account: 30 / minute. Over limit returns HTTP 429 and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">Retry-After</code>.
          </p>
        </div>

        <PublicApiPlayground />

        <p className="text-sm text-muted-foreground">
          Questions?{" "}
          <Link href="/help" className="text-primary underline">
            Help center
          </Link>
          .
        </p>
      </section>
    </main>
  )
}
