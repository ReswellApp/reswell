import { z } from "zod"

export const adminAccountBanPatchSchema = z.object({
  banned: z.boolean(),
  reason: z.string().max(500).nullable().optional(),
})
