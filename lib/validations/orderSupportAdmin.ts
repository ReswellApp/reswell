import { z } from "zod"

export const updateOrderSupportAdminSchema = z.object({
  id: z.string().uuid(),
  support_status: z
    .enum(["new", "triaged", "waiting_on_customer", "investigating", "resolved", "closed"])
    .optional(),
  internal_notes: z.string().max(20000).nullable().optional(),
  outcome: z
    .enum(["approved", "partial", "denied", "withdrawn", "cancelled", "informed"])
    .nullable()
    .optional(),
  assignee_admin_id: z.string().uuid().nullable().optional(),
})

export type UpdateOrderSupportAdminInput = z.infer<typeof updateOrderSupportAdminSchema>
