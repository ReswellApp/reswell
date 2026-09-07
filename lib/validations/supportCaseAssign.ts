import { z } from "zod"

export const assignSupportCaseSchema = z.object({
  backend: z.enum(["contact_message", "order_support", "support_case"]),
  id: z.string().uuid(),
  assignee_admin_id: z.string().uuid().nullable(),
})

export type AssignSupportCaseInput = z.infer<typeof assignSupportCaseSchema>
