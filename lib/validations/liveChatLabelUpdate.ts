import { z } from "zod"

export const liveChatLabelUpdateReasonSchema = z.enum([
  "wrong_from_address",
  "moved",
  "other",
])

export type LiveChatLabelUpdateReason = z.infer<typeof liveChatLabelUpdateReasonSchema>

export const liveChatLabelUpdateConfirmSchema = z.object({
  visitor_token: z.string().uuid().optional(),
  order_id: z.string().uuid(),
  ship_from_address_id: z.string().uuid(),
  reason: liveChatLabelUpdateReasonSchema,
  reason_note: z.string().trim().max(500).optional(),
})
