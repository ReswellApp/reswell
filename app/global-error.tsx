"use client"

import { useEffect, useState } from "react"
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/utils/is-chunk-load-error"

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, so it must render
 * its own `<html>`/`<body>`. Replaces Next.js's unbranded default fatal screen.
 *
 * Stale-asset failures after a deploy (`ChunkLoadError`) self-heal with one fresh reload;
 * everything else gets a branded recover/back UI. Kept dependency-light on purpose.
 */
export default function GlobalError({
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
    console.error("[app] global error:", error)

    // Inline fetch — avoid importing app modules that may have caused the layout failure.
    const controller = new AbortController()
    void fetch("/api/ops/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "client",
        name: error.name,
        message: error.message || "Global error",
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
        context: { boundary: "app/global-error" },
      }),
      keepalive: true,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json()) as { data?: { referenceCode?: string } }
        if (json.data?.referenceCode) setReferenceCode(json.data.referenceCode)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [error])

  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">
        <div className="flex min-h-dvh w-full items-center justify-center px-6 py-16">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            {recovering ? (
              <div
                className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-500"
                role="status"
                aria-label="Loading page"
              />
            ) : (
              <>
                <h1 className="text-[22px] font-semibold tracking-tight">Something went wrong</h1>
                <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
                  We hit an unexpected error. Reload to try again, or head back home.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                  >
                    Reload
                  </button>
                  <a
                    href="/"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-300 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100"
                  >
                    Go home
                  </a>
                </div>
                {(referenceCode || error.digest) && (
                  <p className="mt-6 text-xs text-neutral-400">
                    Ref: {referenceCode ?? error.digest}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
