import { z } from "zod"

export const AD_SALES_RANGE_DAYS = [7, 28, 90] as const

export const adAttributedSalesQuerySchema = z.object({
  days: z
    .enum(["7", "28", "90"])
    .optional()
    .default("28")
    .transform((value) => Number(value) as (typeof AD_SALES_RANGE_DAYS)[number]),
})

export type AdAttributedSalesQuery = z.infer<typeof adAttributedSalesQuerySchema>
