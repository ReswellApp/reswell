import { z } from "zod"
import { profileAddressInputSchema } from "@/lib/address-input"
import type { ProfileAddressRow } from "@/lib/profile-address"

const MAX_JSON_CHUNKS = 24
const CHUNK_SIZE = 450

export const sessionlessGuestCheckoutPayloadSchema = z
  .object({
    buyer_email: z.string().trim().email().max(320),
    fulfillment: z.enum(["pickup", "shipping"]),
    pickup: z
      .object({
        full_name: z.string().trim().min(1).max(200),
      })
      .optional(),
    shipping: profileAddressInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "pickup") {
      if (!data.pickup) {
        ctx.addIssue({ code: "custom", message: "Pickup full name is required.", path: ["pickup"] })
      }
    } else if (!data.shipping) {
      ctx.addIssue({ code: "custom", message: "Shipping address is required.", path: ["shipping"] })
    }
  })

export type SessionlessGuestCheckoutPayload = z.infer<typeof sessionlessGuestCheckoutPayloadSchema>

/** Body for `/api/stripe/create-payment-intent` when `guest_checkout` is true. */
export const sessionlessGuestPaymentRequestSchema = z
  .object({
    listing_id: z.string().trim().min(1),
    guest_checkout: z.literal(true),
    buyer_email: z.string().trim().email().max(320),
    fulfillment: z.enum(["pickup", "shipping"]),
    pickup: z
      .object({
        full_name: z.string().trim().min(1).max(200),
      })
      .optional(),
    shipping: profileAddressInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "pickup") {
      if (!data.pickup) {
        ctx.addIssue({ code: "custom", message: "Pickup full name is required.", path: ["pickup"] })
      }
    } else if (!data.shipping) {
      ctx.addIssue({ code: "custom", message: "Shipping address is required.", path: ["shipping"] })
    }
  })

export type SessionlessGuestPaymentRequest = z.infer<typeof sessionlessGuestPaymentRequestSchema>

export function sessionlessGuestShippingToProfileAddressRow(
  s: NonNullable<SessionlessGuestCheckoutPayload["shipping"]>,
): ProfileAddressRow {
  const now = new Date().toISOString()
  return {
    id: "guest-inline",
    profile_id: "00000000-0000-0000-0000-000000000000",
    full_name: s.full_name,
    phone: s.phone?.trim() ? s.phone.trim() : null,
    line1: s.line1,
    line2: s.line2?.trim() || null,
    city: s.city,
    state: s.state?.trim() || null,
    postal_code: s.postal_code,
    country: s.country,
    label: s.label?.trim() ?? null,
    is_default: true,
    created_at: now,
    updated_at: now,
  }
}

export type SessionlessGuestStripeDecode =
  | { ok: true; payload: SessionlessGuestCheckoutPayload }
  | { ok: false; error: string }

/** Stripe PaymentIntent metadata values are max 500 chars; keys max 40. */
export function sessionlessGuestPayloadToStripeMetadata(
  payload: SessionlessGuestCheckoutPayload,
): Record<string, string> {
  const json = JSON.stringify(payload)
  const chunks: string[] = []
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    chunks.push(json.slice(i, i + CHUNK_SIZE))
  }
  if (chunks.length > MAX_JSON_CHUNKS) {
    throw new Error("Guest checkout payload exceeds Stripe metadata limits")
  }
  const meta: Record<string, string> = {
    guest_chk: "1",
    gc_n: String(chunks.length),
  }
  chunks.forEach((c, i) => {
    meta[`gc_${i}`] = c
  })
  return meta
}

export function stripeMetadataToSessionlessGuestPayload(
  meta: Record<string, string> | null | undefined,
): SessionlessGuestStripeDecode {
  if (!meta || meta.guest_chk !== "1") {
    return { ok: false, error: "Not a guest checkout payment" }
  }
  const n = parseInt(String(meta.gc_n ?? ""), 10)
  if (!Number.isFinite(n) || n < 1 || n > MAX_JSON_CHUNKS) {
    return { ok: false, error: "Invalid guest checkout metadata" }
  }
  let json = ""
  for (let i = 0; i < n; i++) {
    const part = meta[`gc_${i}`]
    if (typeof part !== "string") {
      return { ok: false, error: "Incomplete guest checkout metadata" }
    }
    json += part
  }
  let raw: unknown
  try {
    raw = JSON.parse(json) as unknown
  } catch {
    return { ok: false, error: "Invalid guest checkout payload" }
  }
  const parsed = sessionlessGuestCheckoutPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid guest checkout payload" }
  }
  return { ok: true, payload: parsed.data }
}
