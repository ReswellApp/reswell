import { isAndroidWebViewBridgeNoise } from "@/lib/utils/is-android-webview-bridge-noise"

declare global {
  interface Window {
    __reswellWebViewBridgeNoiseSuppressorInstalled?: boolean
  }
}

/**
 * Swallow Android WebView Java-bridge teardown errors before PostHog autocapture
 * and the ops reporter see them (see instrumentation-client.ts).
 */
export function installWebViewBridgeNoiseSuppressor(): void {
  if (typeof window === "undefined") return
  if (window.__reswellWebViewBridgeNoiseSuppressorInstalled) return
  window.__reswellWebViewBridgeNoiseSuppressorInstalled = true

  function swallowBridgeNoise(event: PromiseRejectionEvent | ErrorEvent): void {
    const reason =
      event instanceof PromiseRejectionEvent
        ? event.reason
        : event.error ?? event.message
    if (!isAndroidWebViewBridgeNoise(reason) && !isAndroidWebViewBridgeNoise(event.message)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      swallowBridgeNoise(event)
    },
    { capture: true },
  )

  window.addEventListener(
    "error",
    (event) => {
      swallowBridgeNoise(event)
    },
    { capture: true },
  )

  const reportError = window.reportError?.bind(window)
  if (reportError) {
    window.reportError = (error: unknown) => {
      if (isAndroidWebViewBridgeNoise(error)) return
      reportError(error)
    }
  }
}
