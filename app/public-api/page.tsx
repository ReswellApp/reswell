import { PublicApiPlayground } from "@/components/features/public-api/public-api-playground"
import { PublicApiReference } from "@/components/features/public-api/public-api-reference"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const revalidate = 86400

export async function generateMetadata() {
  return resolvePageMetadata("public-api")
}

const facts = [
  "No API key",
  "CORS open",
  "Free: 10 req/min",
  "Registered: 30 req/min",
  "JSON only",
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
          <ul className="mt-5 flex flex-wrap gap-2">
            {facts.map((fact) => (
              <li
                key={fact}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
              >
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <PublicApiPlayground />
        <PublicApiReference />
      </section>
    </main>
  )
}
