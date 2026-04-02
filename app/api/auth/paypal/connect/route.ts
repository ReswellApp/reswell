import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPayPalPublicAppUrl } from "@/lib/paypal-public-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim()
  if (!clientId) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID" },
      { status: 500 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const state = Buffer.from(
    JSON.stringify({ userId: user.id, timestamp: Date.now() }),
  ).toString("base64")

  const appUrl = getPayPalPublicAppUrl()
  const redirectUri = `${appUrl}/api/auth/paypal/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    state,
  })

  const live = process.env.PAYPAL_MODE?.trim() === "live"
  const baseUrl = live
    ? "https://www.paypal.com/signin/authorize"
    : "https://www.sandbox.paypal.com/signin/authorize"

  const authUrl = `${baseUrl}?${params.toString()}`

  return NextResponse.json({ url: authUrl })
}
