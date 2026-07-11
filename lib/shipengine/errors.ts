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
    if (parts.length) return appendShipEngineFundsHint(parts.join(" "))
  }

  if (typeof r.message === "string" && r.message.trim()) {
    return appendShipEngineFundsHint(r.message.trim())
  }

  return ""
}

/** Some carriers reject branded label images — caller should retry without `label_image_id`. */
export function isLabelImagesNotSupportedError(data: unknown): boolean {
  const r = asRecord(data)
  if (!r) return false

  const errors = r.errors
  if (Array.isArray(errors)) {
    for (const e of errors) {
      const er = asRecord(e)
      if (!er) continue
      const code =
        typeof er.error_code === "string"
          ? er.error_code
          : typeof er.errorCode === "string"
            ? er.errorCode
            : null
      if (code === "label_images_not_supported") return true
    }
  }

  const msg = formatShipEngineApiError(data)
  return /label_images_not_supported/i.test(msg)
}

/** Carrier billing / account balance issues — surface a clear next step for admins. */
function appendShipEngineFundsHint(message: string): string {
  if (/insufficient funds|insufficient balance/i.test(message)) {
    return `${message} Add funds to your ShipEngine or carrier account, or use ShipEngine sandbox API keys for testing.`
  }
  return message
}
