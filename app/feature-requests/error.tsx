"use client"

import { useChunkLoadRecovery } from "@/lib/client/use-chunk-load-recovery"
import { isChunkLoadError } from "@/lib/utils/is-chunk-load-error"

interface FeatureRequestsErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function FeatureRequestsError({ error, reset }: FeatureRequestsErrorProps) {
  const recovering = useChunkLoadRecovery(error)

  if (recovering) {
    return (
      <main
        className="flex flex-1 items-center justify-center bg-white"
        role="status"
        aria-label="Loading page"
      />
    )
  }

  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-headline text-2xl font-bold text-neutral-950">Feature requests are unavailable</h1>
        <p className="mt-2 text-sm text-neutral-600">Refresh the page and try again.</p>
        <button
          type="button"
          onClick={() => {
            if (isChunkLoadError(error)) {
              window.location.reload()
              return
            }
            reset()
          }}
          className="mt-6 h-10 rounded-full bg-[#3B6CF6] px-4 text-sm font-medium text-white hover:bg-[#2F5FE0]"
        >
          {isChunkLoadError(error) ? "Reload page" : "Try again"}
        </button>
      </div>
    </main>
  )
}
