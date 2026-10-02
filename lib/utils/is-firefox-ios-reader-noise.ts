/**
 * Firefox for iOS injects Reader Mode code that calls its private
 * `window.__firefox__.reader` bridge. The bridge can be unavailable while the
 * injected script runs, producing a page-level `window.onerror` even though no
 * application code is involved.
 */

const FIREFOX_READER_BRIDGE = /\b(?:window\.)?__firefox__\.reader\b/i

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
    const exception = item as Record<string, unknown>
    for (const key of ["type", "value", "$exception_type", "$exception_message", "$exception_stack_trace_raw"] as const) {
      const value = exception[key]
      if (typeof value === "string") parts.push(value)
    }
  }

  return parts.join("\n")
}

/** Drop `$exception` events caused by Firefox iOS's injected Reader Mode bridge. */
export function isPostHogFirefoxIosReaderNoise(event: PostHogEventLike): boolean {
  if (!event || event.event !== "$exception") return false
  return FIREFOX_READER_BRIDGE.test(collectExceptionText(event.properties))
}
