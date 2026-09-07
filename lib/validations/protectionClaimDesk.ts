import { z } from "zod"
import { PROTECTION_REPAIR_CREDIT_MAX_USD } from "@/lib/types/protectionClaimDesk"

export const carrierClaimStatusSchema = z.enum([
  "not_started",
  "ready_to_file",
  "filed",
  "under_review",
  "approved",
  "denied",
  "paid",
  "withdrawn",
])

export const updateProtectionCarrierClaimSchema = z.object({
  order_support_request_id: z.string().uuid(),
  carrier_claim_status: carrierClaimStatusSchema.nullable().optional(),
  carrier_claim_id: z.string().trim().max(200).nullable().optional(),
  carrier_claim_url: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || /^https?:\/\//i.test(v), {
      message: "Claim URL must start with http(s)",
    }),
  insurance_claim_url: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || /^https?:\/\//i.test(v), {
      message: "Insurance claim URL must start with http(s)",
    }),
  notify_customer: z.boolean().optional(),
})

export const grantProtectionRepairCreditSchema = z.object({
  order_support_request_id: z.string().uuid(),
  amount_usd: z
    .number()
    .positive()
    .max(PROTECTION_REPAIR_CREDIT_MAX_USD)
    .refine((n) => Math.round(n * 100) === n * 100 || Number.isFinite(n), {
      message: "Amount must be a valid dollar value",
    }),
  note: z.string().trim().max(2000).optional(),
  set_outcome_partial: z.boolean().optional().default(true),
  notify_customer: z.boolean().optional().default(true),
})

export type UpdateProtectionCarrierClaimInput = z.infer<typeof updateProtectionCarrierClaimSchema>
export type GrantProtectionRepairCreditInput = z.infer<typeof grantProtectionRepairCreditSchema>
