import { z } from "zod"
import type { SupportCaseKind } from "@/lib/types/supportCase"

export const ADMIN_CREATE_SUPPORT_CASE_KINDS = [
  "general",
  "order_question",
  "cancel_request",
  "protection_claim",
  "safety",
  "payments",
  "account",
] as const satisfies readonly SupportCaseKind[]

export const adminCreateSupportCaseKindSchema = z.enum(ADMIN_CREATE_SUPPORT_CASE_KINDS)

export const adminCreateSupportCaseSchema = z.object({
  user_id: z.string().uuid(),
  order_id: z.string().uuid().nullable().optional(),
  kind: adminCreateSupportCaseKindSchema,
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(8000),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
})

export const adminUserOrdersForSupportSchema = z.object({
  user_id: z.string().uuid(),
  offset: z.number().int().min(0).max(10_000).default(0),
  limit: z.number().int().min(1).max(25).default(8),
  role: z.enum(["all", "buyer", "seller"]).default("all"),
  search: z.string().trim().max(80).default(""),
})

export type AdminCreateSupportCaseInput = z.infer<typeof adminCreateSupportCaseSchema>
export type AdminUserOrdersForSupportInput = z.infer<typeof adminUserOrdersForSupportSchema>
