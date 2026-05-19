import { z } from "zod"

export const adminReswellSellerPatchSchema = z.object({
  userId: z.string().uuid(),
  grant: z.boolean(),
})
