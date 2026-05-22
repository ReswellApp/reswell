"use client"

/**
 * Globally swallow `AbortError` reports so they don't surface in the Next.js
 * dev overlay.
 *
 * Next.js 16 + Turbopack (and React 19 strict-mode effect re-runs) routinely
 * abort in-flight fetches and RSC prefetches during route transitions, HMR
 * reloads, and effect cleanups. The abort is intentional — the work was
 * canceled — but if any caller forgot a `.catch()` the rejection (or the raw
 * abort throw) bubbles up to the dev overlay as:
 *
 *   "Runtime AbortError: signal is aborted without reason"
 *
 * Next.js's dev overlay subscribes to three sources to report runtime errors:
 *   1. `window.unhandledrejection`
 *   2. `window.error`
 *   3. a patched `console.error`
 *
 * We suppress *only* the AbortError variants on each channel. Real errors
 * still surface normally because they don't match the AbortError signature.
 *
 * Installation happens at module load (not inside `useEffect`) so we register
 * before the React commit phase that wires up the dev overlay listeners. We
 * also use the `capture` phase + `stopImmediatePropagation()` so the overlay's
 * own handler never runs for these events.
 */

function isAbortLike(value: unknown): boolean {
  if (value == null) return false
  if (value instanceof Error) {
    if (value.name === "AbortError") return true
    if (typeof value.message === "string") {
      const m = value.message.toLowerCase()
      if (m.includes("signal is aborted")) return true
      if (m.includes("the user aborted")) return true
      if (m.includes("the operation was aborted")) return true
    }
    return false
  }
  if (typeof value === "object") {
    const name = (value as { name?: unknown }).name
    if (name === "AbortError") return true
    const message = (value as { message?: unknown }).message
    if (typeof message === "string" && message.toLowerCase().includes("aborted")) return true
  }
  if (typeof value === "string") {
    const s = value.toLowerCase()
    if (s.includes("aborterror")) return true
    if (s.includes("signal is aborted")) return true
  }
  return false
}

function installSuppressor(): void {
  if (typeof window === "undefined") return
  const w = window as Window & { __reswellAbortSuppressorInstalled?: boolean }
  if (w.__reswellAbortSuppressorInstalled) return
  w.__reswellAbortSuppressorInstalled = true

  function onUnhandledRejection(event: PromiseRejectionEvent): void {
    if (isAbortLike(event.reason)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  function onError(event: ErrorEvent): void {
    if (isAbortLike(event.error) || isAbortLike(event.message)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  window.addEventListener("unhandledrejection", onUnhandledRejection, { capture: true })
  window.addEventListener("error", onError, { capture: true })

  // The Next.js dev overlay also captures errors logged through `console.error`.
  // Drop AbortError logs so they don't bubble into the overlay's red banner.
  if (process.env.NODE_ENV !== "production") {
    const originalConsoleError = console.error
    console.error = function patchedConsoleError(...args: unknown[]): void {
      for (const arg of args) {
        if (isAbortLike(arg)) return
      }
      originalConsoleError.apply(console, args as Parameters<typeof console.error>)
    }
  }
}

installSuppressor()

export function AbortErrorSuppressor(): null {
  return null
}
