/**
 * ShipEngine error bodies often use `{ errors: [{ error_code, message }] }`
 * instead of a top-level `message`.
 */
function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

export function formatShipEngineApiError(data: unknown): string {
  const r = asRecord(data)
  if (!r) return ""

  const errors = r.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const parts: string[] = []
    for (const e of errors) {
      const er = asRecord(e)
      if (!er) continue
      const code =
        typeof er.error_code === "string"
          ? er.error_code
          : typeof er.errorCode === "string"
            ? er.errorCode
            : null
      const msg = typeof er.message === "string" ? er.message : null
      if (code && msg) parts.push(`${code}: ${msg}`)
      else if (msg) parts.push(msg)
      else if (code) parts.push(code)
    }
    if (parts.length) return parts.join(" ")
  }

  if (typeof r.message === "string" && r.message.trim()) {
    return r.message.trim()
  }

  return ""
}
