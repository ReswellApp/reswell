import { z } from "zod"

export const contactMessageSupportStatusSchema = z.enum([
  "new",
  "triaged",
  "ticket_created",
  "resolved",
])

export const updateContactMessageAdminSchema = z.object({
  id: z.string().uuid(),
  support_status: contactMessageSupportStatusSchema.optional(),
  internal_notes: z.string().max(20000).optional(),
})

export type UpdateContactMessageAdminInput = z.infer<typeof updateContactMessageAdminSchema>
