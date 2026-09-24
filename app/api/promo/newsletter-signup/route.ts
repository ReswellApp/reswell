import { NextResponse } from "next/server"

const JSON_HEADERS = {
  "Cache-Control": "no-store",
} as const

/**
 * Anonymous email capture no longer mints a promo.
 * The 15% code is issued when a Reswell account is created, then sent on the
 * Klaviyo **New Account Created** welcome flow (and the Newsletter metric for new codes).
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Create an account to receive your promo code.",
      requiresAccount: true,
    },
    { status: 403, headers: JSON_HEADERS },
  )
}
