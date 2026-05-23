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

function messageLooksAborted(value: string): boolean {
  const message = value.toLowerCase()
  return (
    message.includes("aborterror") ||
    message.includes("signal is aborted") ||
    message.includes("aborted without reason") ||
    message.includes("the user aborted") ||
    message.includes("the operation was aborted")
  )
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
    if (isAbortError(value)) return true
  }

  const combined = values.map(stringifyAbortCandidate).join(" ")
  return messageLooksAborted(combined)
}
