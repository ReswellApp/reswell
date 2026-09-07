"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isAndroidWebViewBridgeNoise } from "@/lib/utils/is-android-webview-bridge-noise"
import { isBenignClientFetchError } from "@/lib/utils/is-abort-error"
import { isStaleFileNotFoundError } from "@/lib/utils/is-stale-file-not-found-error"
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/utils/is-chunk-load-error"
import { reportClientError } from "@/lib/utils/reportClientError"
import posthog from "posthog-js"

/**
 * Root route error boundary. Catches uncaught errors thrown while rendering any route
 * segment (so the user keeps the site chrome instead of Next.js's full-page fatal screen).
 *
 * Stale-asset failures after a deploy (`ChunkLoadError`) self-heal with one fresh reload;
 * anything else shows a branded, recoverable fallback and reports to platform ops.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [recovering, setRecovering] = useState(false)
  const [referenceCode, setReferenceCode] = useState<string | null>(null)

  useEffect(() => {
    if (isChunkLoadError(error)) {
      const reloaded = recoverFromChunkLoadError()
      if (reloaded) {
        setRecovering(true)
        return
      }
    }
    if (isAndroidWebViewBridgeNoise(error)) return
    if (isBenignClientFetchError(error)) return
    if (isStaleFileNotFoundError(error)) return
    console.error("[app] route error:", error)
    posthog.captureException(error)
    void reportClientError({
      name: error.name,
      message: error.message || "Route error",
      stack: error.stack,
      digest: error.digest,
      context: { boundary: "app/error" },
    }).then((result) => {
      if (result?.referenceCode) setReferenceCode(result.referenceCode)
    })
  }, [error])

  if (recovering) {
    return (
      <main
        className="flex flex-1 items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 px-4 py-16"
        role="status"
        aria-label="Loading page"
      >
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground/60" aria-hidden />
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
        {(referenceCode || error.digest) && (
          <p className="mt-6 text-xs text-muted-foreground">
            Ref: {referenceCode ?? error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
