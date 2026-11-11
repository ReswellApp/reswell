"use client"

import { useEffect, useState } from "react"
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/utils/is-chunk-load-error"

/**
 * Self-heal stale-asset failures after a deploy. Returns whether a reload is in
 * flight so the boundary can show a spinner instead of the fallback UI.
 */
export function useChunkLoadRecovery(error: unknown): boolean {
  const [recovering, setRecovering] = useState(() => isChunkLoadError(error))

  useEffect(() => {
    if (!isChunkLoadError(error)) {
      setRecovering(false)
      return
    }
    const reloaded = recoverFromChunkLoadError()
    setRecovering(reloaded)
  }, [error])

  return recovering
}
