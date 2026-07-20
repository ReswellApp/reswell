"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/utils/is-chunk-load-error"
import { reportClientError } from "@/lib/utils/reportClientError"

/**
 * Sell flow error boundary. Listing drafts autosave to IndexedDB (and to server
 * drafts for boards/fins), so a render crash here must never dead-end a seller:
 * we reassure them their work is saved and offer recovery paths.
 *
 * Stale-asset failures after a deploy (`ChunkLoadError`) self-heal with one
 * fresh reload, matching the root boundary.
 */
export default function SellError({
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
    console.error("[sell] page error:", error)
    void reportClientError({
      name: error.name,
      message: error.message || "Sell route error",
      stack: error.stack,
      digest: error.digest,
      context: { boundary: "app/sell/error" },
    }).then((result) => {
      if (result?.referenceCode) setReferenceCode(result.referenceCode)
    })
  }, [error])

  if (recovering) {
    return (
      <main
        className="flex flex-1 items-center justify-center bg-background px-4 py-16"
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
          Don&apos;t worry — your listing draft is saved on this device. Try again
          and pick up right where you left off.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => reset()} className="rounded-full">
            Try again
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
          <Button variant="ghost" asChild className="rounded-full">
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
