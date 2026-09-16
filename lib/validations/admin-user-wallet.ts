import { z } from "zod"

/** Path param for `/api/admin/users/[userId]/wallet` */
export const adminWalletUserIdParamSchema = z.string().uuid()

export const adminWalletCreditSchema = z.object({
  amount_usd: z.number().positive().max(5000),
  note: z.string().trim().max(500).optional(),
})
