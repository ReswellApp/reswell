import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

export const runtime = "nodejs"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown"

  const { data: method } = await supabase
    .from("seller_payment_methods")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!method) {
    return NextResponse.json({ error: "Payment method not found" }, { status: 404 })
  }

  const { error } = await supabase
    .from("seller_payment_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: "Failed to remove payment method" }, { status: 500 })
  }

  // If deleted method was default, promote another
  if (method.is_default) {
    const { data: remaining } = await supabase
      .from("seller_payment_methods")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)

    if (remaining && remaining.length > 0) {
      await supabase
        .from("seller_payment_methods")
        .update({ is_default: true })
        .eq("id", remaining[0].id)
    }
  }

  // Audit log
  await supabase.from("payout_security_log").insert({
    user_id: user.id,
    action: "method_removed",
    details: { method_id: id, type: method.type },
    ip_address: ip,
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { make_default } = await request.json()

  if (make_default) {
    // Clear all defaults first
    await supabase
      .from("seller_payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id)

    const { error } = await supabase
      .from("seller_payment_methods")
      .update({ is_default: true })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to update payment method" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
