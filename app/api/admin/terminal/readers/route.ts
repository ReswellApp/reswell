import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  getStripeTerminalLocationId,
  listTerminalReadersForLocation,
} from "@/lib/services/stripeTerminal"

export const dynamic = "force-dynamic"

/** GET /api/admin/terminal/readers — list Stripe Terminal readers for the configured location. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
  }

  const locationId = getStripeTerminalLocationId()
  if (!locationId) {
    return NextResponse.json(
      { error: "Stripe Terminal is not configured. Set STRIPE_TERMINAL_LOCATION_ID." },
      { status: 503 },
    )
  }

  try {
    const readers = await listTerminalReadersForLocation(locationId)
    return NextResponse.json({ data: { readers, locationId } })
  } catch (e) {
    console.error("[api/admin/terminal/readers] list failed", e)
    return NextResponse.json({ error: "Could not load readers." }, { status: 502 })
  }
}
