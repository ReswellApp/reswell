import { z } from "zod"

export const brandModelRequestSellPostBodySchema = z
  .object({
    brandId: z.string().uuid().optional(),
    sellerBrandName: z.string().trim().max(200).optional(),
    requestedModelName: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    const hasBrandId = Boolean(data.brandId?.trim())
    const free = data.sellerBrandName?.trim() ?? ""
    const hasFreeBrand = free.length > 0
    if (!hasBrandId && !hasFreeBrand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a directory brand or the brand name you typed on your listing.",
        path: ["brandId"],
      })
    }
    if (hasBrandId && hasFreeBrand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Send either brandId or sellerBrandName, not both.",
        path: ["sellerBrandName"],
      })
    }
  })

export type BrandModelRequestSellPostBody = z.infer<typeof brandModelRequestSellPostBodySchema>

