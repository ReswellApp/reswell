export function newsletterPromoEventProperties(input: {
  email: string
  promoCode: string
  discountPercent: number
  expiresAt: string
  isNewCode: boolean
  shopOrigin: string
}): Record<string, unknown> {
  const origin = input.shopOrigin.replace(/\/$/, "")
  const expiresDate = new Date(input.expiresAt)
  const expiresFormatted = Number.isFinite(expiresDate.getTime())
    ? expiresDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : input.expiresAt

  return {
    email: input.email,
    promo_code: input.promoCode,
    discount_percent: input.discountPercent,
    discount_label: `${input.discountPercent}% off`,
    expires_at: input.expiresAt,
    expires_at_formatted: expiresFormatted,
    shop_url: `${origin}/boards`,
    is_new_code: input.isNewCode,
  }
}
