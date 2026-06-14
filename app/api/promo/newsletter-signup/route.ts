import { NextRequest, NextResponse } from "next/server"
import { NEWSLETTER_PROMO_DISCOUNT_PERCENT } from "@/lib/constants/newsletter-promo"
import { createNewsletterPromoSignup } from "@/lib/services/newsletterPromo"
import { newsletterSignupBodySchema } from "@/lib/validations/newsletterPromo"

const JSON_HEADERS = {
  "Cache-Control": "no-store",
} as const

/** Public: visitor newsletter signup → unique one-time promo code + Klaviyo Newsletter event. */
export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: JSON_HEADERS })
  }

  const parsed = newsletterSignupBodySchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.email?.[0]
    return NextResponse.json(
      { error: first ?? "Enter a valid email address." },
      { status: 400, headers: JSON_HEADERS },
    )
  }

  const result = await createNewsletterPromoSignup(parsed.data.email)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, alreadySignedUp: result.alreadySignedUp === true },
      { status: result.alreadySignedUp ? 409 : 500, headers: JSON_HEADERS },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      message: `Check your inbox — your ${NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off code is on the way.`,
    },
    { headers: JSON_HEADERS },
  )
}
