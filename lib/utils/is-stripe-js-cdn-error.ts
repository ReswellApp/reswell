/**
 * `@stripe/stripe-js` injects https://js.stripe.com and rejects when the
 * <script> `error` event fires:
 *
 *   new Error("Failed to load Stripe.js", { cause: event })
 *
 * PostHog exception autocapture then reports two shapes of the same miss:
 * the Error message, and the raw DOM Event serialized as
 * "Event captured as exception with keys: isTrusted".
 *
 * Checkout retries that load and reports exhausted misses itself
 * ("Failed to load Stripe.js after retries"). Autocapture of the CDN miss
 * is not an application bug.
 */

const STRIPE_JS_LOAD = /failed to load stripe\.js/i
const STRIPE_JS_AFTER_RETRIES = /failed to load stripe\.js after retries/i
const STRIPE_JS_UNAVAILABLE = /stripe\.js not available/i
const DOM_EVENT_AS_EXCEPTION = /event captured as exception with keys:/i
const TRUSTED_EVENT_KEY = /\bistrusted\b/i
const STRIPE_JS_FRAMES = /\bonErrorListener\b|@stripe\/stripe-js|js\.stripe\.com/i

function messageLooksLikeStripeJsCdnFailure(value: string): boolean {
  if (!value.trim()) return false
  if (STRIPE_JS_AFTER_RETRIES.test(value)) return false
  if (STRIPE_JS_LOAD.test(value) || STRIPE_JS_UNAVAILABLE.test(value)) return true
  return (
    DOM_EVENT_AS_EXCEPTION.test(value) &&
    TRUSTED_EVENT_KEY.test(value) &&
    STRIPE_JS_FRAMES.test(value)
  )
}

/** True when `error` is Stripe.js failing to load from js.stripe.com. */
export function isStripeJsCdnLoadError(error: unknown, depth = 0): boolean {
  if (error == null || depth > 4) return false

  if (error instanceof Error) {
    if (messageLooksLikeStripeJsCdnFailure(`${error.name} ${error.message} ${error.stack ?? ""}`)) {
      return true
    }
    if ("cause" in error && isStripeJsCdnLoadError(error.cause, depth + 1)) return true
    return false
  }

  if (typeof error === "string") return messageLooksLikeStripeJsCdnFailure(error)

  if (typeof error === "object") {
    const rec = error as { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown }
    const combined = [rec.name, rec.message, rec.stack]
      .filter((part): part is string => typeof part === "string")
      .join(" ")
    if (combined && messageLooksLikeStripeJsCdnFailure(combined)) return true
    if ("cause" in error && isStripeJsCdnLoadError(rec.cause, depth + 1)) return true
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
    for (const key of [
      "type",
      "value",
      "$exception_type",
      "$exception_message",
      "$exception_stack_trace_raw",
    ] as const) {
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

/** Drop `$exception` events that are Stripe.js CDN script-load failures. */
export function isPostHogStripeJsCdnLoadError(event: PostHogEventLike): boolean {
  if (!event || event.event !== "$exception") return false
  return isStripeJsCdnLoadError(collectExceptionText(event.properties))
}
