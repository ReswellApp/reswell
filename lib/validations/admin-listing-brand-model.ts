import { z } from "zod"

const uuid = z.string().uuid()

/** Admin assigns directory brand and/or catalog model to a surfboard listing. */
export const adminListingBrandModelBodySchema = z
  .object({
    brand_id: uuid.nullish(),
    brand_model_id: uuid.nullish(),
  })
  .refine((v) => Boolean(v.brand_id?.trim() || v.brand_model_id?.trim()), {
    message: "Provide brand_id and/or brand_model_id",
  })

export type AdminListingBrandModelBody = z.infer<typeof adminListingBrandModelBodySchema>
