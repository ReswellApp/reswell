import { z } from "zod"

/** Path param for `/api/admin/users/[userId]/wallet` */
export const adminWalletUserIdParamSchema = z.string().uuid()

/** Credits above this require an explicit confirm before the wallet is updated. */
export const ADMIN_WALLET_CREDIT_CONFIRM_ABOVE_USD = 250
export const ADMIN_WALLET_CREDIT_HARD_MAX_USD = 5000

export const adminWalletCreditSchema = z
  .object({
    amount_usd: z.number().positive().max(ADMIN_WALLET_CREDIT_HARD_MAX_USD),
    note: z.string().trim().max(500).optional(),
    confirm_over_limit: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amount_usd > ADMIN_WALLET_CREDIT_CONFIRM_ABOVE_USD && data.confirm_over_limit !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Confirm amounts over $${ADMIN_WALLET_CREDIT_CONFIRM_ABOVE_USD}`,
        path: ["confirm_over_limit"],
      })
    }
  })
