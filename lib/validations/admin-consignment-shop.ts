import { z } from "zod"

export const adminConsignmentShopPatchSchema = z.object({
  userId: z.string().uuid(),
  grant: z.boolean(),
})
