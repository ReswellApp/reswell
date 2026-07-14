import { z } from "zod"

export const userSupportTicketFilterSchema = z.enum(["all", "open", "resolved"])

export const userSupportTicketReplySchema = z.object({
  ticket_id: z.string().uuid(),
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(15000, "Message is too long."),
})

export type UserSupportTicketReplyInput = z.infer<typeof userSupportTicketReplySchema>
