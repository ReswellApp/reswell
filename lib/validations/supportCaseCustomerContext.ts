import { z } from "zod"

export const CUSTOMER_PANEL_MAX_PAGE = 25

const caseIdSchema = z.string().trim().min(1).max(80)

const orderRoleSchema = z.enum(["all", "buyer", "seller"]).default("all")

export const supportCaseCustomerContextSchema = z.object({
  case_id: caseIdSchema,
})

export const supportCaseCustomerOrdersPageSchema = z.object({
  case_id: caseIdSchema,
  offset: z.number().int().min(0).max(10_000).default(0),
  limit: z.number().int().min(1).max(CUSTOMER_PANEL_MAX_PAGE).default(8),
  role: orderRoleSchema,
  search: z.string().trim().max(80).default(""),
})

export const supportCaseCustomerTicketsPageSchema = z.object({
  case_id: caseIdSchema,
  offset: z.number().int().min(0).max(10_000).default(0),
  limit: z.number().int().min(1).max(CUSTOMER_PANEL_MAX_PAGE).default(8),
})

export const linkSupportCaseOrderSchema = z.object({
  case_id: caseIdSchema,
  order_id: z.string().uuid(),
})

export type LinkSupportCaseOrderInput = z.infer<typeof linkSupportCaseOrderSchema>
export type SupportCaseCustomerOrdersPageInput = z.infer<
  typeof supportCaseCustomerOrdersPageSchema
>
export type SupportCaseCustomerTicketsPageInput = z.infer<
  typeof supportCaseCustomerTicketsPageSchema
>
