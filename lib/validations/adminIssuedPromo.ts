import { z } from "zod"
import {
  ADMIN_ISSUED_PROMO_MAX_PERCENT,
  ADMIN_ISSUED_PROMO_MIN_PERCENT,
} from "@/lib/constants/admin-issued-promo"

export const adminIssuedPromoGenerateBodySchema = z.object({
  discount_percent: z.coerce
    .number()
    .int("Discount must be a whole number.")
    .min(ADMIN_ISSUED_PROMO_MIN_PERCENT, `Minimum discount is ${ADMIN_ISSUED_PROMO_MIN_PERCENT}%.`)
    .max(ADMIN_ISSUED_PROMO_MAX_PERCENT, `Maximum discount is ${ADMIN_ISSUED_PROMO_MAX_PERCENT}%.`),
  note: z
    .string()
    .trim()
    .max(200, "Note must be 200 characters or fewer.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})

export type AdminIssuedPromoGenerateBody = z.infer<typeof adminIssuedPromoGenerateBodySchema>
