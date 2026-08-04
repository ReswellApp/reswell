import { z } from "zod"

export const adminSellerBanPatchSchema = z.object({
  banned: z.boolean(),
  reason: z.string().max(500).nullable().optional(),
})
