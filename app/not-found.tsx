import Link from "next/link"
import type { Metadata } from "next"
import { Home, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildAgentNotFoundMarkdown } from "@/lib/agent/not-found-markdown"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export const metadata: Metadata = {
  title: "Page not found — Reswell",
  description: "We could not find that page.",
}

export default function NotFound() {
  const origin = publicSiteOrigin()
  const agentMarkdown = buildAgentNotFoundMarkdown(origin)

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-16 text-center sm:py-24">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex justify-center">
          <div
            className="animate-bounce rounded-full bg-muted p-5 shadow-soft ring-1 ring-border motion-reduce:animate-none"
            aria-hidden
          >
            <Waves className="size-14 text-foreground sm:size-16" strokeWidth={1.75} />
          </div>
        </div>

        <p className="font-headline text-6xl font-bold leading-none tracking-tight text-foreground sm:text-7xl">
          404
        </p>

        <h1 className="mt-4 text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Wiped out — this page isn&apos;t on the map
        </h1>

        <p className="mt-3 text-pretty text-sm text-muted-foreground sm:text-base">
          The link may be broken, or the listing sailed away. Paddle back to the home break and
          try again.
        </p>

        <p className="mt-3 text-pretty text-sm text-muted-foreground">
          Looking for a machine-readable index? See{" "}
          <Link href="/sitemap.xml" className="underline underline-offset-2 hover:text-foreground">
            sitemap.xml
          </Link>
          ,{" "}
          <Link href="/llms.txt" className="underline underline-offset-2 hover:text-foreground">
            llms.txt
          </Link>
          ,{" "}
          <Link href="/openapi.json" className="underline underline-offset-2 hover:text-foreground">
            openapi.json
          </Link>
          , or{" "}
          <Link href="/public-api" className="underline underline-offset-2 hover:text-foreground">
            API docs
          </Link>
          .
        </p>

        <pre className="sr-only">{agentMarkdown}</pre>

        <Button asChild size="lg" className="mt-8 shadow-soft">
          <Link href="/" prefetch>
            <Home className="size-4" aria-hidden />
            Back to homepage
          </Link>
        </Button>
      </div>
    </main>
  )
}
