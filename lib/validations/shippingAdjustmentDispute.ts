import { z } from "zod"
import {
  ADJUSTMENT_DISPUTE_CARRIERS,
  ADJUSTMENT_DISPUTE_REASON_CODES,
} from "@/lib/shipping/adjustment-fee"

const claimedDim = z.number().positive().max(300).optional()

export const submitShippingAdjustmentDisputeSchema = z.object({
  adjustmentId: z.string().uuid(),
  carrier: z.enum(ADJUSTMENT_DISPUTE_CARRIERS),
  reasonCode: z.enum(ADJUSTMENT_DISPUTE_REASON_CODES),
  sellerStatement: z
    .string()
    .trim()
    .min(20, "Tell Reswell a bit more about the packed package.")
    .max(2000),
  claimedLengthIn: claimedDim,
  claimedWidthIn: claimedDim,
  claimedHeightIn: claimedDim,
  claimedWeightLb: z.number().positive().max(150).optional(),
})

export const adminShippingAdjustmentDisputeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit_to_carrier"),
    disputeId: z.string().uuid(),
    carrierReference: z.string().trim().min(2).max(120).optional(),
    note: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("resolve"),
    disputeId: z.string().uuid(),
    note: z.string().trim().min(2).max(2000),
  }),
  z.object({
    action: z.literal("deny"),
    disputeId: z.string().uuid(),
    note: z.string().trim().min(2).max(2000),
  }),
])

export type SubmitShippingAdjustmentDisputeInput = z.infer<
  typeof submitShippingAdjustmentDisputeSchema
>
