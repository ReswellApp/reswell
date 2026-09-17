import { z } from "zod"

export const liveChatShippingActionTypeSchema = z.enum([
  "void_shipping_label",
  "replace_shipping_label",
])

export type LiveChatShippingActionType = z.infer<typeof liveChatShippingActionTypeSchema>

export const liveChatParcelSchema = z.object({
  lengthIn: z.number().positive().max(120),
  widthIn: z.number().positive().max(120),
  heightIn: z.number().positive().max(120),
  weightLb: z.number().positive().max(150),
})

export const liveChatProposeShippingActionSchema = z.object({
  type: liveChatShippingActionTypeSchema,
  order_query: z.string().trim().min(1).max(160),
  /** Required for replace; ignored for void. */
  parcel: liveChatParcelSchema.optional(),
  rate_id: z.string().trim().min(1).max(120).optional(),
  ship_from_address_id: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
})

export const liveChatConfirmActionSchema = z.object({
  action_id: z.string().uuid(),
  decision: z.enum(["confirm", "cancel"]),
  visitor_token: z.string().uuid().optional(),
})

export const liveChatListActionsSchema = z.object({
  visitor_token: z.string().uuid().optional(),
})
