import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getPayPalPublicAppUrl } from "@/lib/paypal-public-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATE_MAX_AGE_MS = 15 * 60 * 1000

function redirectPopup(status: "connected" | "error") {
  const base = getPayPalPublicAppUrl()
  return NextResponse.redirect(`${base}/auth/paypal/popup-close?status=${status}`)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const stateParam = searchParams.get("state")
  const err = searchParams.get("error")

  if (err || !code || !stateParam) {
    return redirectPopup("error")
  }

  let state: { userId: string; timestamp: number }
  try {
    const decoded = Buffer.from(stateParam, "base64").toString("utf8")
    state = JSON.parse(decoded) as { userId: string; timestamp: number }
  } catch {
    return redirectPopup("error")
  }

  if (
    !state.userId ||
    typeof state.timestamp !== "number" ||
    Date.now() - state.timestamp > STATE_MAX_AGE_MS
  ) {
    return redirectPopup("error")
  }

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return redirectPopup("error")
  }

  const appUrl = getPayPalPublicAppUrl()
  const redirectUri = `${appUrl}/api/auth/paypal/callback`
  const live = process.env.PAYPAL_MODE?.trim() === "live"
  const apiBase = live ? "https://api.paypal.com" : "https://api.sandbox.paypal.com"

  const tokenRes = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = (await tokenRes.json()) as { access_token?: string }

  if (!tokenData.access_token) {
    console.error("[paypal oauth] token exchange failed:", tokenData)
    return redirectPopup("error")
  }

  const userRes = await fetch(
    `${apiBase}/v1/identity/openidconnect/userinfo?schema=openid`,
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
    },
  )

  const paypalUser = (await userRes.json()) as {
    email?: string
    name?: string
    given_name?: string
    family_name?: string
    payer_id?: string
    user_id?: string
    sub?: string
  }

  const email = typeof paypalUser.email === "string" ? paypalUser.email : null
  const payerId =
    (typeof paypalUser.payer_id === "string" && paypalUser.payer_id) ||
    (typeof paypalUser.user_id === "string" && paypalUser.user_id) ||
    (typeof paypalUser.sub === "string" && paypalUser.sub) ||
    null
  const displayName =
    typeof paypalUser.name === "string"
      ? paypalUser.name
      : [paypalUser.given_name, paypalUser.family_name].filter(Boolean).join(" ") ||
        null

  if (!email && !payerId) {
    console.error("[paypal oauth] missing identity fields:", paypalUser)
    return redirectPopup("error")
  }

  const supabase = createServiceRoleClient()
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      paypal_email: email,
      paypal_payer_id: payerId,
      paypal_display_name: displayName,
      paypal_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.userId)

  if (updateErr) {
    console.error("[paypal oauth] profile update:", updateErr)
    return redirectPopup("error")
  }

  return redirectPopup("connected")
}
