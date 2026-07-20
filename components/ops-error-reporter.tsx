"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/utils/reportClientError"
import { isChunkLoadError } from "@/lib/utils/is-chunk-load-error"

/**
 * Captures unhandled window errors and promise rejections into the ops store.
 * Chunk-load failures are ignored (handled by route error boundaries with reload).
 */
export function OpsErrorReporter(): null {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const err = event.error
      if (err instanceof Error && isChunkLoadError(err)) return
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
      if (reason instanceof Error && isChunkLoadError(reason)) return
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
