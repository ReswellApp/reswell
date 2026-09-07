"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/utils/reportClientError"
import { isAndroidWebViewBridgeNoise } from "@/lib/utils/is-android-webview-bridge-noise"
import { isBenignClientFetchError } from "@/lib/utils/is-abort-error"
import { isChunkLoadError } from "@/lib/utils/is-chunk-load-error"
import { isStaleFileNotFoundError } from "@/lib/utils/is-stale-file-not-found-error"

/**
 * Captures unhandled window errors and promise rejections into the ops store.
 * Chunk-load failures are ignored (handled by route error boundaries with reload).
 */
export function OpsErrorReporter(): null {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const err = event.error
      if (
        isChunkLoadError(err) ||
        isAndroidWebViewBridgeNoise(err ?? event.message) ||
        isBenignClientFetchError(err ?? event.message) ||
        isStaleFileNotFoundError(err ?? event.message)
      ) {
        return
      }
      const message = event.message || (err instanceof Error ? err.message : "Unhandled error")
      if (!message || message === "Script error.") return

      void reportClientError({
        name: err instanceof Error ? err.name : "Error",
        message,
        stack: err instanceof Error ? err.stack : undefined,
        context: { type: "window.onerror", filename: event.filename, lineno: event.lineno },
      })
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (
        isChunkLoadError(reason) ||
        isAndroidWebViewBridgeNoise(reason) ||
        isBenignClientFetchError(reason) ||
        isStaleFileNotFoundError(reason)
      ) {
        return
      }
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection"
      void reportClientError({
        name: reason instanceof Error ? reason.name : "UnhandledRejection",
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
        context: { type: "unhandledrejection" },
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
