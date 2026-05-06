import { z } from "zod"

export const supportTicketReplyFromAdminSchema = z.object({
  ticket_id: z.string().uuid(),
  content: z.string().min(1).max(12000),
})

export type SupportTicketReplyFromAdminInput = z.infer<typeof supportTicketReplyFromAdminSchema>

export const ensureSupportTicketThreadSchema = z.object({
  ticket_id: z.string().uuid(),
})

export type EnsureSupportTicketThreadInput = z.infer<typeof ensureSupportTicketThreadSchema>
