import { z } from "zod"

export const messagesSupportTopicSchema = z.enum([
  "general",
  "account",
  "buying_selling",
  "payments",
  "safety",
  "other",
])

export type MessagesSupportTopic = z.infer<typeof messagesSupportTopicSchema>

export const messagesSupportTopicLabels: Record<MessagesSupportTopic, string> = {
  general: "General help",
  account: "My account",
  buying_selling: "Buying or selling",
  payments: "Payments & payouts",
  safety: "Safety or another member",
  other: "Something else",
}

export const submitMessagesSupportTicketSchema = z.object({
  topic: messagesSupportTopicSchema,
  details: z.string().trim().min(10, "Please add a bit more detail (at least 10 characters).").max(10000),
  related_conversation_id: z.string().uuid().optional().nullable(),
})

export type SubmitMessagesSupportTicketInput = z.infer<typeof submitMessagesSupportTicketSchema>
