import { z } from "zod"

export const adminShopifyAccessPatchSchema = z.object({
  userId: z.string().uuid(),
  grant: z.boolean(),
})
