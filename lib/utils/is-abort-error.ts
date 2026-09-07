/** True when a fetch / Supabase / router transition intentionally canceled in-flight work. */
export function isAbortError(err: unknown, depth = 0): boolean {
  if (err == null || depth > 4) return false

  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "AbortError" || err.code === 20
  }

  if (err instanceof Error) {
    if (err.name === "AbortError") return true
    if (messageLooksAborted(err.message)) return true
    if ("cause" in err && isAbortError(err.cause, depth + 1)) return true
    return false
  }

  if (typeof err === "object") {
    const name = (err as { name?: unknown }).name
    if (name === "AbortError") return true
    const message = (err as { message?: unknown }).message
    if (typeof message === "string" && messageLooksAborted(message)) return true
    if ("cause" in err && isAbortError((err as { cause?: unknown }).cause, depth + 1)) {
      return true
    }
  }

  if (typeof err === "string") {
    return messageLooksAborted(err)
  }

  return false
}

/**
 * Browser-specific TypeError messages when `fetch()` cannot complete
 * (navigation abort, flaky radio, CORS, offline). Not application bugs.
 * Chrome: "Failed to fetch"
 * Safari / WebKit: "Load failed"
 * Firefox: "NetworkError when attempting to fetch resource."
 */
function isBenignFetchFailureMessage(value: string): boolean {
  const message = value.trim().toLowerCase()
  return (
    message === "failed to fetch" ||
    message === "load failed" ||
    message === "networkerror when attempting to fetch resource." ||
    message === "networkerror when attempting to fetch resource" ||
    message.endsWith(": failed to fetch") ||
    message.endsWith(": load failed") ||
    message.includes("networkerror when attempting to fetch resource")
  )
}

function messageLooksAborted(value: string): boolean {
  const message = value.toLowerCase()
  return (
    message.includes("aborterror") ||
    message.includes("signal is aborted") ||
    message.includes("aborted without reason") ||
    message.includes("the user aborted") ||
    message.includes("the operation was aborted") ||
    isBenignFetchFailureMessage(value)
  )
}

/** Navigation / HMR often aborts in-flight server actions as a TypeError from fetch(). */
export function isBenignClientFetchError(err: unknown, depth = 0): boolean {
  if (isAbortError(err, depth)) return true
  if (err instanceof Error && isBenignFetchFailureMessage(err.message)) return true
  if (typeof err === "object" && err !== null) {
    const message = (err as { message?: unknown }).message
    if (typeof message === "string" && isBenignFetchFailureMessage(message)) return true
  }
  if (typeof err === "string" && isBenignFetchFailureMessage(err)) return true
  return false
}

function stringifyAbortCandidate(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Error) return `${value.name} ${value.message}`
  if (value == null) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Match abort errors even when Next.js wraps them in console.error strings. */
export function containsAbortErrorSignal(...values: unknown[]): boolean {
  for (const value of values) {
    if (isAbortError(value) || isBenignClientFetchError(value)) return true
  }

  const combined = values.map(stringifyAbortCandidate).join(" ")
  return messageLooksAborted(combined)
}

type PostHogEventLike = {
  event?: string
  properties?: Record<string, unknown> | null
} | null | undefined

function postHogExceptionMessages(event: PostHogEventLike): string[] {
  const properties = event?.properties
  if (!properties) return []

  const messages: string[] = []
  const topMessage = properties.$exception_message
  if (typeof topMessage === "string") messages.push(topMessage)

  const list = properties.$exception_list
  if (!Array.isArray(list)) return messages

  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    if (typeof rec.value === "string") messages.push(rec.value)
    if (typeof rec.$exception_message === "string") messages.push(rec.$exception_message)
  }

  return messages
}

/** Drop `$exception` events that are browser fetch failures, not application bugs. */
export function isPostHogBenignClientFetchError(event: PostHogEventLike): boolean {
  if (!event || event.event !== "$exception") return false
  return postHogExceptionMessages(event).some((message) => isBenignClientFetchError(message))
}
