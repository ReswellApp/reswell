import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

export const runtime = "nodejs"

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data } = await supabase
    .from("seller_payment_methods")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })

  return NextResponse.json({ methods: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown"

  const body = await request.json()
  const { type, bank_name, account_last4, routing_last4, card_brand, card_last4, card_exp, paypal_email, stripe_pm_id, make_default } = body

  if (!["BANK_ACCOUNT", "DEBIT_CARD", "PAYPAL"].includes(type)) {
    return NextResponse.json({ error: "Invalid payment method type" }, { status: 400 })
  }

  // Validate required fields per type
  if (type === "BANK_ACCOUNT" && (!account_last4 || !routing_last4)) {
    return NextResponse.json({ error: "Bank account requires account and routing numbers" }, { status: 400 })
  }
  if (type === "DEBIT_CARD" && (!card_last4 || !card_exp)) {
    return NextResponse.json({ error: "Debit card requires card number and expiry" }, { status: 400 })
  }
  if (type === "PAYPAL" && !paypal_email) {
    return NextResponse.json({ error: "PayPal requires an email address" }, { status: 400 })
  }

  // If making default, clear existing defaults first
  if (make_default) {
    await supabase
      .from("seller_payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id)
  }

  const isFirst = async () => {
    const { count } = await supabase
      .from("seller_payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
    return (count ?? 0) === 0
  }

  const shouldBeDefault = make_default || (await isFirst())

  const { data: method, error } = await supabase
    .from("seller_payment_methods")
    .insert({
      user_id: user.id,
      type,
      is_default: shouldBeDefault,
      bank_name: bank_name ?? null,
      account_last4: account_last4 ?? null,
      routing_last4: routing_last4 ?? null,
      card_brand: card_brand ?? null,
      card_last4: card_last4 ?? null,
      card_exp: card_exp ?? null,
      paypal_email: paypal_email ?? null,
      stripe_pm_id: stripe_pm_id ?? null,
      verified: type === "PAYPAL" ? false : Boolean(stripe_pm_id),
    })
    .select()
    .single()

  if (error || !method) {
    console.error("[payment-methods] Insert error:", error)
    return NextResponse.json({ error: "Failed to save payment method" }, { status: 500 })
  }

  // Audit log
  await supabase.from("payout_security_log").insert({
    user_id: user.id,
    action: "method_added",
    details: { type, method_id: method.id, destination: paypal_email ?? card_last4 ?? account_last4 },
    ip_address: ip,
  })

  return NextResponse.json({ method })
}
