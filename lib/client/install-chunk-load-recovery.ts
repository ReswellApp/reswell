import {
  isChunkLoadError,
  isNextStaticAssetLoadFailure,
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

  function maybeRecover(reason: unknown, event?: Event): boolean {
    const shouldRecover =
      isChunkLoadError(reason) || (event != null && isNextStaticAssetLoadFailure(event))
    if (!shouldRecover) return false
    if (event && "preventDefault" in event) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    recoverFromChunkLoadError()
    return true
  }

  window.addEventListener(
    "error",
    (event) => {
      maybeRecover(event.error ?? event.message, event)
    },
    { capture: true },
  )

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      maybeRecover(event.reason, event)
    },
    { capture: true },
  )

  const reportError = window.reportError?.bind(window)
  if (reportError) {
    window.reportError = (error: unknown) => {
      if (isChunkLoadError(error)) {
        recoverFromChunkLoadError()
        return
      }
      reportError(error)
    }
  }
}
