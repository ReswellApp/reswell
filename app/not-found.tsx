import Link from 'next/link'
import type { Metadata } from 'next'
import { Home, Waves } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Page not found — Reswell',
  description: 'We could not find that page.',
}

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-muted/60 via-background to-background px-4 py-16 text-center sm:py-24">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex justify-center">
          <div
            className="animate-bounce rounded-full bg-muted p-5 shadow-soft ring-1 ring-border motion-reduce:animate-none"
            aria-hidden
          >
            <Waves className="size-14 text-foreground sm:size-16" strokeWidth={1.75} />
          </div>
        </div>

        <p className="font-[family-name:var(--font-caveat)] text-6xl leading-none text-foreground sm:text-7xl">
          404
        </p>

        <h1 className="mt-4 text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Wiped out — this page isn&apos;t on the map
        </h1>

        <p className="mt-3 text-pretty text-sm text-muted-foreground sm:text-base">
          The link may be broken, or the listing sailed away. Paddle back to the home break and
          try again.
        </p>

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
