import { z } from "zod"

export const supportCaseCustomerContextSchema = z.object({
  case_id: z.string().uuid(),
})

export const linkSupportCaseOrderSchema = z.object({
  case_id: z.string().uuid(),
  order_id: z.string().uuid(),
})

export type LinkSupportCaseOrderInput = z.infer<typeof linkSupportCaseOrderSchema>
