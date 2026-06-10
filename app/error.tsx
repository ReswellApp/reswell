"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/utils/is-chunk-load-error"

/**
 * Root route error boundary. Catches uncaught errors thrown while rendering any route
 * segment (so the user keeps the site chrome instead of Next.js's full-page fatal screen).
 *
 * Stale-asset failures after a deploy (`ChunkLoadError`) self-heal with one fresh reload;
 * anything else shows a branded, recoverable fallback.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (isChunkLoadError(error)) {
      const reloaded = recoverFromChunkLoadError()
      if (reloaded) {
        setRecovering(true)
        return
      }
    }
    console.error("[app] route error:", error)
  }, [error])

  if (recovering) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background px-4 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-[15px] text-muted-foreground">Updating to the latest version…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col bg-background">
      <div className="container mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          We hit an unexpected error. Try again and it should resolve. If it keeps happening,
          contact support.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => reset()} className="rounded-full">
            Try again
          </Button>
          <Button variant="outline" asChild className="rounded-full">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
