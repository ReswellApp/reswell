import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "@/lib/utils/is-chunk-load-error"

declare global {
  interface Window {
    __reswellChunkRecoveryInstalled?: boolean
  }
}

/**
 * Catch stale/missing chunk failures before React error boundaries mount. Without this,
 * Next.js's built-in fatal screen ("This page couldn't load") can still appear when the
 * error-boundary bundle itself is part of the failed load.
 */
export function installChunkLoadRecovery(): void {
  if (typeof window === "undefined") return
  if (window.__reswellChunkRecoveryInstalled) return
  window.__reswellChunkRecoveryInstalled = true

  function maybeRecover(reason: unknown): void {
    if (!isChunkLoadError(reason)) return
    recoverFromChunkLoadError()
  }

  window.addEventListener(
    "error",
    (event) => {
      maybeRecover(event.error ?? event.message)
    },
    { capture: true },
  )

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      maybeRecover(event.reason)
    },
    { capture: true },
  )
}
