import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteConnectBankAccount,
  setDefaultConnectBankAccount,
} from "@/lib/services/stripeConnect"
import { stripeConnectExternalAccountBodySchema } from "@/lib/validations/stripe-connect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseBody(req: Request): Promise<unknown> {
  return req.json().catch(() => null)
}

export async function DELETE(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await parseBody(req)
  const parsed = stripeConnectExternalAccountBodySchema.safeParse(body)
  if (!parsed.success) {
    const f = parsed.error.flatten()
    const msg =
      f.fieldErrors.externalAccountId?.[0] ?? f.formErrors[0] ?? "Invalid request"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await deleteConnectBankAccount(
    supabase,
    user.id,
    parsed.data.externalAccountId,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await parseBody(req)
  const parsed = stripeConnectExternalAccountBodySchema.safeParse(body)
  if (!parsed.success) {
    const f = parsed.error.flatten()
    const msg =
      f.fieldErrors.externalAccountId?.[0] ?? f.formErrors[0] ?? "Invalid request"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await setDefaultConnectBankAccount(
    supabase,
    user.id,
    parsed.data.externalAccountId,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
