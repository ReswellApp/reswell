import { z } from "zod"

const headerMapSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())])).nullish()

export const resendEmailReceivedSchema = z.object({
  type: z.literal("email.received"),
  created_at: z.string().optional(),
  data: z
    .object({
      email_id: z.string().min(1),
      from: z.string().min(1),
      to: z.array(z.string()).optional(),
      cc: z.array(z.string()).optional(),
      received_for: z.array(z.string()).optional(),
      subject: z.string().nullable().optional(),
      message_id: z.string().nullable().optional(),
      text: z.string().nullable().optional(),
      html: z.string().nullable().optional(),
      headers: headerMapSchema,
    })
    .passthrough(),
})

export const resendWebhookEnvelopeSchema = z
  .object({
    type: z.string(),
    created_at: z.string().optional(),
    data: z.unknown().optional(),
  })
  .passthrough()

export const genericInboundEmailSchema = z.object({
  from: z.string().min(1),
  to: z.union([z.string().min(1), z.array(z.string())]).optional(),
  subject: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  email_id: z.string().optional(),
  message_id: z.string().nullable().optional(),
  headers: headerMapSchema,
})

export type ResendEmailReceivedPayload = z.infer<typeof resendEmailReceivedSchema>
export type GenericInboundEmailPayload = z.infer<typeof genericInboundEmailSchema>

export type NormalizedInboundEmail = {
  inboundEmailId: string
  from: string
  to: string[]
  subject: string
  text: string
  html: string
  headers: Record<string, string>
  messageId: string | null
  needsResendFetch: boolean
}

function asAddressList(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

function asHeaderMap(
  value: Record<string, string | string[]> | null | undefined,
): Record<string, string> {
  if (!value) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    out[key] = Array.isArray(raw) ? (raw[0] ?? "") : raw
  }
  return out
}

export function normalizedInboundFromResend(
  payload: ResendEmailReceivedPayload,
): NormalizedInboundEmail {
  const data = payload.data
  const to = [...asAddressList(data.to), ...asAddressList(data.received_for)]
  const text = data.text?.trim() ?? ""
  const html = data.html?.trim() ?? ""
  return {
    inboundEmailId: data.email_id,
    from: data.from,
    to,
    subject: data.subject?.trim() ?? "",
    text,
    html,
    headers: asHeaderMap(data.headers),
    messageId: data.message_id?.trim() || null,
    needsResendFetch: !text && !html,
  }
}

export function normalizedInboundFromGeneric(
  payload: GenericInboundEmailPayload,
  fallbackId: string,
): NormalizedInboundEmail {
  return {
    inboundEmailId: payload.email_id?.trim() || payload.message_id?.trim() || fallbackId,
    from: payload.from,
    to: asAddressList(payload.to),
    subject: payload.subject?.trim() ?? "",
    text: payload.text?.trim() ?? "",
    html: payload.html?.trim() ?? "",
    headers: asHeaderMap(payload.headers),
    messageId: payload.message_id?.trim() || null,
    needsResendFetch: false,
  }
}
