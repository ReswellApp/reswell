"use client"

import { useEffect, useState } from "react"
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/utils/is-chunk-load-error"

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, so it must render
 * its own `<html>`/`<body>`. Replaces Next.js's unbranded default fatal screen.
 *
 * Stale-asset failures after a deploy (`ChunkLoadError`) self-heal with one fresh reload;
 * everything else gets a branded recover/back UI. Kept dependency-free on purpose — the app
 * shell already failed, so we avoid importing components that could fail too.
 */
export default function GlobalError({
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
    console.error("[app] global error:", error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">
        <div className="flex min-h-dvh w-full items-center justify-center px-6 py-16">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            {recovering ? (
              <p className="text-[15px] text-neutral-500">Updating to the latest version…</p>
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
                {error.digest ? (
                  <p className="mt-6 text-xs text-neutral-400">Ref: {error.digest}</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
