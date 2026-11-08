"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useChunkLoadRecovery } from "@/lib/client/use-chunk-load-recovery"
import { isChunkLoadError } from "@/lib/utils/is-chunk-load-error"

export default function DashboardOffersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const recovering = useChunkLoadRecovery(error)

  useEffect(() => {
    if (isChunkLoadError(error)) return
    console.error("[dashboard/offers]", error)
  }, [error])

  if (recovering) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center"
        role="status"
        aria-label="Loading page"
      />
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
      <h1 className="text-lg font-semibold text-foreground">Something went wrong loading offers</h1>
      <p className="text-sm text-muted-foreground">
        {process.env.NODE_ENV === "development" ? (
          <>
            <span className="font-mono text-xs break-all text-destructive">{error.message}</span>
            <span className="mt-2 block">
              Often this is a missing Supabase env (see <code className="rounded bg-muted px-1">.env.example</code>) or a
              build running without valid <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_*</code> keys.
            </span>
          </>
        ) : (
          "Please try again. If it keeps happening, contact support."
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="default"
          onClick={() => {
            if (isChunkLoadError(error)) {
              window.location.reload()
              return
            }
            reset()
          }}
        >
          {isChunkLoadError(error) ? "Reload page" : "Try again"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/listings">Back to listings</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>
      )}
    </div>
  )
}
