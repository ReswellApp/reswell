import { z } from "zod"
import { normalizeNewsletterPromoCodeInput, normalizeNewsletterPromoEmail } from "@/lib/utils/newsletter-promo-code"

export const newsletterSignupBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .transform(normalizeNewsletterPromoEmail),
})

export const newsletterPromoValidateBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter your promo code")
    .transform(normalizeNewsletterPromoCodeInput),
})

export type NewsletterSignupBody = z.infer<typeof newsletterSignupBodySchema>
export type NewsletterPromoValidateBody = z.infer<typeof newsletterPromoValidateBodySchema>
