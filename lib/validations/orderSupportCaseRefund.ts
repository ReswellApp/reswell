import { z } from "zod"
import { MARKETPLACE_ORDER_REFUND_DISPOSITIONS } from "@/lib/services/marketplaceOrderRefundDisposition"

export const issueOrderSupportCaseRefundSchema = z.object({
  case_id: z.string().uuid(),
  order_id: z.string().uuid(),
  disposition: z.enum(MARKETPLACE_ORDER_REFUND_DISPOSITIONS),
  allow_after_repair_credit: z.boolean().optional(),
  notify_customer: z.boolean().optional(),
})

export type IssueOrderSupportCaseRefundInput = z.infer<
  typeof issueOrderSupportCaseRefundSchema
>
