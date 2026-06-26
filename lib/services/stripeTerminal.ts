import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe-server"

export type TerminalReaderSummary = {
  id: string
  label: string
  status: string | null
  deviceType: string
  serialNumber: string | null
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
