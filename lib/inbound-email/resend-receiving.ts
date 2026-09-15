/**
 * Fetch the body of a Resend Receiving email. The email.received webhook
 * is metadata-only — text/html live on this API.
 * @see https://resend.com/docs/dashboard/receiving/get-email-content
 */

export type ResendReceivedEmail = {
  from: string
  to: string[]
  subject: string
  text: string
  html: string
  headers: Record<string, string>
  messageId: string | null
}

type ResendReceivingJson = {
  from?: unknown
  to?: unknown
  received_for?: unknown
  subject?: unknown
  text?: unknown
  html?: unknown
  headers?: unknown
  message_id?: unknown
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function asHeaderMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw
  }
  return out
}

export async function fetchResendReceivedEmail(
  emailId: string,
): Promise<ResendReceivedEmail | { error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not configured" }
  }

  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("[inbound-email] Resend receiving fetch failed", res.status, detail.slice(0, 200))
    return { error: `Resend receiving fetch failed (${res.status})` }
  }

  let json: unknown
  try {
    json = (await res.json()) as unknown
  } catch {
    return { error: "Resend receiving response was not JSON" }
  }

  const body = json && typeof json === "object" ? (json as ResendReceivingJson) : {}
  const from = typeof body.from === "string" ? body.from : ""
  if (!from.trim()) return { error: "Resend receiving email missing from" }

  return {
    from,
    to: [...asStringList(body.to), ...asStringList(body.received_for)],
    subject: typeof body.subject === "string" ? body.subject : "",
    text: typeof body.text === "string" ? body.text : "",
    html: typeof body.html === "string" ? body.html : "",
    headers: asHeaderMap(body.headers),
    messageId: typeof body.message_id === "string" ? body.message_id : null,
  }
}
