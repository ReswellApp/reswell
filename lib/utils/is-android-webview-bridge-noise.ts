/**
 * Facebook / Instagram / Threads (and other) Android in-app browsers inject
 * `navigation_performance_logger_android`. That script calls a Java
 * `@JavascriptInterface` (`sendDataToNative` → `postMessage`). After navigation
 * or WebView teardown the Java object is GC'd and the bridge throws:
 *
 *   Error invoking postMessage: Java object is gone
 *
 * PostHog marks the frames IN-APP because the injected source is
 * `Unknown Source`. This is not first-party code — `window.postMessage` never
 * throws this wording.
 */

const JAVA_OBJECT_GONE = /Java object is gone/i
const ERROR_INVOKING_BRIDGE = /Error invoking \S+:/i
const BRIDGE_FRAME_TOKENS =
  /sendDataToNative|sendBeforeUnloadMessage|sendJsBlockingTimeMessage|navigation_performance_logger|navigationPerformanceLogger/i

function messageLooksLikeBridgeNoise(value: string): boolean {
  if (!JAVA_OBJECT_GONE.test(value)) return false
  return ERROR_INVOKING_BRIDGE.test(value) || BRIDGE_FRAME_TOKENS.test(value)
}

/** True when `error` is the Android WebView Java-bridge teardown throw. */
export function isAndroidWebViewBridgeNoise(error: unknown, depth = 0): boolean {
  if (error == null || depth > 4) return false

  if (error instanceof Error) {
    if (messageLooksLikeBridgeNoise(`${error.name} ${error.message} ${error.stack ?? ""}`)) {
      return true
    }
    if ("cause" in error && isAndroidWebViewBridgeNoise(error.cause, depth + 1)) return true
    return false
  }

  if (typeof error === "string") return messageLooksLikeBridgeNoise(error)

  if (typeof error === "object") {
    const rec = error as { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown }
    const combined = [rec.name, rec.message, rec.stack]
      .filter((part): part is string => typeof part === "string")
      .join(" ")
    if (combined && messageLooksLikeBridgeNoise(combined)) return true
    if ("cause" in error && isAndroidWebViewBridgeNoise(rec.cause, depth + 1)) return true
  }

  return false
}

type PostHogEventLike = {
  event?: string
  properties?: Record<string, unknown> | null
} | null | undefined

function collectExceptionText(properties: Record<string, unknown> | null | undefined): string {
  if (!properties) return ""
  const parts: string[] = []

  const topMessage = properties.$exception_message
  if (typeof topMessage === "string") parts.push(topMessage)

  const list = properties.$exception_list
  if (!Array.isArray(list)) return parts.join("\n")

  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    for (const key of ["type", "value", "$exception_type", "$exception_message", "$exception_stack_trace_raw"] as const) {
      const value = rec[key]
      if (typeof value === "string") parts.push(value)
    }
    const stacktrace = rec.stacktrace
    if (stacktrace && typeof stacktrace === "object") {
      const frames = (stacktrace as { frames?: unknown }).frames
      if (Array.isArray(frames)) {
        for (const frame of frames) {
          if (!frame || typeof frame !== "object") continue
          const f = frame as Record<string, unknown>
          for (const key of ["function", "filename", "abs_path"] as const) {
            const value = f[key]
            if (typeof value === "string") parts.push(value)
          }
        }
      }
    }
  }

  return parts.join("\n")
}

/** Drop `$exception` events that are Android WebView native-bridge noise. */
export function isPostHogAndroidWebViewBridgeNoise(event: PostHogEventLike): boolean {
  if (!event || event.event !== "$exception") return false
  return isAndroidWebViewBridgeNoise(collectExceptionText(event.properties))
}
