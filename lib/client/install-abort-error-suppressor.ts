import { containsAbortErrorSignal, isAbortError, isBenignClientFetchError } from "@/lib/utils/is-abort-error"

declare global {
  interface Window {
    __reswellAbortSuppressorInstalled?: boolean
  }
}

/** Register global handlers before Next.js dev overlay wiring (see instrumentation-client.ts). */
export function installAbortErrorSuppressor(): void {
  if (typeof window === "undefined") return
  if (window.__reswellAbortSuppressorInstalled) return
  window.__reswellAbortSuppressorInstalled = true

  function swallowAbortEvent(event: PromiseRejectionEvent | ErrorEvent): void {
    const reason =
      event instanceof PromiseRejectionEvent
        ? event.reason
        : event.error ?? event.message
    if (!containsAbortErrorSignal(reason, event.message)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      swallowAbortEvent(event)
    },
    { capture: true },
  )

  window.addEventListener(
    "error",
    (event) => {
      swallowAbortEvent(event)
    },
    { capture: true },
  )

  const reportError = window.reportError?.bind(window)
  if (reportError) {
    window.reportError = (error: unknown) => {
      if (isAbortError(error) || isBenignClientFetchError(error)) return
      reportError(error)
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const originalConsoleError = console.error
    console.error = function patchedConsoleError(...args: unknown[]): void {
      if (containsAbortErrorSignal(...args)) return
      originalConsoleError.apply(console, args as Parameters<typeof console.error>)
    }
  }
}
