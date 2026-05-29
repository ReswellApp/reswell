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

export const bulkUpdateContactMessagesAdminSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one ticket").max(500),
  support_status: contactMessageSupportStatusSchema,
})

export type BulkUpdateContactMessagesAdminInput = z.infer<
  typeof bulkUpdateContactMessagesAdminSchema
>
