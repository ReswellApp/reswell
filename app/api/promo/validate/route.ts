import { NextRequest, NextResponse } from "next/server"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { validateNewsletterPromoForCheckout } from "@/lib/services/newsletterPromo"
import { createClient } from "@/lib/supabase/server"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { newsletterPromoValidateBodySchema } from "@/lib/validations/newsletterPromo"

const JSON_HEADERS = {
  "Cache-Control": "no-store",
} as const

/** Authenticated checkout: validate a newsletter promo code against item subtotal + buyer email. */
export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: JSON_HEADERS })
  }

  const parsed = newsletterPromoValidateBodySchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.code?.[0]
    return NextResponse.json(
      { error: first ?? "Enter a valid promo code." },
      { status: 400, headers: JSON_HEADERS },
    )
  }

  const itemSubtotalUsd = Number((raw as { item_subtotal_usd?: unknown }).item_subtotal_usd)
  const shippingUsd = Number((raw as { shipping_usd?: unknown }).shipping_usd ?? 0)

  if (!Number.isFinite(itemSubtotalUsd) || itemSubtotalUsd <= 0) {
    return NextResponse.json({ error: "Invalid order subtotal." }, { status: 400, headers: JSON_HEADERS })
  }
  if (!Number.isFinite(shippingUsd) || shippingUsd < 0) {
    return NextResponse.json({ error: "Invalid shipping amount." }, { status: 400, headers: JSON_HEADERS })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in to apply a promo code." }, { status: 401, headers: JSON_HEADERS })
  }

  if (isAnonymousSupabaseUser(user)) {
    return NextResponse.json(
      { error: "Create a Reswell account to use your promo code." },
      { status: 403, headers: JSON_HEADERS },
    )
  }

  const buyerEmail = (await getAuthEmailForUserId(user.id)) ?? user.email?.trim() ?? ""
  if (!buyerEmail) {
    return NextResponse.json(
      { error: "Add an email to your account before using a promo code." },
      { status: 400, headers: JSON_HEADERS },
    )
  }

  const result = await validateNewsletterPromoForCheckout({
    code: parsed.data.code,
    buyerEmail,
    itemSubtotalUsd,
    shippingUsd,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: JSON_HEADERS })
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        promoCodeId: result.promo.id,
        code: result.promo.code,
        discountPercent: result.discountPercent,
        discountUsd: result.discountUsd,
        totalUsd: result.totalUsd,
        expiresAt: result.promo.expires_at,
      },
    },
    { headers: JSON_HEADERS },
  )
}
