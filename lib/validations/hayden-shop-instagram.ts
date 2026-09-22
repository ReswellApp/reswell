import { z } from "zod"

export const haydenShopInstagramListingIdSchema = z.string().trim().uuid("listing id must be a UUID")

export const haydenShopInstagramPhotoQuerySchema = z.object({
  index: z
    .union([z.string(), z.number()])
    .transform((value) => {
      const n = typeof value === "number" ? value : Number(value)
      return Number.isFinite(n) ? Math.trunc(n) : Number.NaN
    })
    .refine((n) => Number.isInteger(n) && n >= 0 && n < 40, "index must be a photo number"),
})
