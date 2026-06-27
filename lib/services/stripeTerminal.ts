import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe-server"

export type TerminalReaderSummary = {
  id: string
  label: string
  status: string | null
  deviceType: string
  serialNumber: string | null
}

export type TerminalReaderCartDisplay = {
  currency?: string
  lineItems: Array<{ description: string; amountCents: number; quantity?: number }>
  totalCents: number
  taxCents?: number
}

const TERMINAL_CART_LINE_DESCRIPTION_MAX = 100

/** Stripe reader cart line text — keep short for S710 screen width. */
export function truncateTerminalCartLineDescription(raw: string, maxLen = TERMINAL_CART_LINE_DESCRIPTION_MAX): string {
  const trimmed = raw.trim().replace(/\s+/g, " ")
  if (!trimmed) return "Reswell item"
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1)}…`
}

function toReaderSummary(reader: Stripe.Terminal.Reader): TerminalReaderSummary {
  return {
    id: reader.id,
    label: reader.label ?? reader.id,
    status: reader.status ?? null,
    deviceType: reader.device_type,
    serialNumber: reader.serial_number ?? null,
  }
}

export function getStripeTerminalLocationId(): string | null {
  const id = process.env.STRIPE_TERMINAL_LOCATION_ID?.trim()
  return id || null
}

/** Internet-connected readers (e.g. Stripe Terminal S710) registered to the platform location. */
export async function listTerminalReadersForLocation(
  locationId: string,
): Promise<TerminalReaderSummary[]> {
  const stripe = getStripe()
  const readers = await stripe.terminal.readers.list({ location: locationId, limit: 100 })
  return readers.data.map(toReaderSummary)
}

export async function getTerminalReader(readerId: string): Promise<TerminalReaderSummary | null> {
  const stripe = getStripe()
  try {
    const reader = await stripe.terminal.readers.retrieve(readerId)
    if (reader.deleted) return null
    return toReaderSummary(reader as Stripe.Terminal.Reader)
  } catch {
    return null
  }
}

/**
 * Shows line items + total on S710/S700 before payment. Display-only — PaymentIntent amount is charged.
 * @see https://docs.stripe.com/terminal/features/display
 */
export async function setTerminalReaderCartDisplay(
  readerId: string,
  cart: TerminalReaderCartDisplay,
): Promise<Stripe.Terminal.Reader> {
  const stripe = getStripe()
  return stripe.terminal.readers.setReaderDisplay(readerId, {
    type: "cart",
    cart: {
      currency: cart.currency ?? "usd",
      line_items: cart.lineItems.map((item) => ({
        description: truncateTerminalCartLineDescription(item.description),
        amount: item.amountCents,
        quantity: item.quantity ?? 1,
      })),
      total: cart.totalCents,
      ...(cart.taxCents != null ? { tax: cart.taxCents } : {}),
    },
  })
}

/** Hands a PaymentIntent to the physical reader so the customer can tap or insert their card. */
export async function processPaymentOnReader(
  readerId: string,
  paymentIntentId: string,
): Promise<Stripe.Terminal.Reader> {
  const stripe = getStripe()
  return stripe.terminal.readers.processPaymentIntent(readerId, {
    payment_intent: paymentIntentId,
  })
}

/** Clears the current action on a reader (cancel an in-progress collection). */
export async function cancelReaderAction(readerId: string): Promise<void> {
  const stripe = getStripe()
  try {
    await stripe.terminal.readers.cancelAction(readerId)
  } catch {
    // Reader may already be idle.
  }
}
