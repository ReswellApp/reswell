import { z } from "zod"
import type { SupportCaseKind } from "@/lib/types/supportCase"

export const SUPPORT_MACRO_KIND_FILTERS = [
  "general",
  "order_question",
  "cancel_request",
  "protection_claim",
  "safety",
  "payments",
  "account",
] as const satisfies readonly SupportCaseKind[]

export const supportMacroKindFilterSchema = z.enum(SUPPORT_MACRO_KIND_FILTERS)

const emptyToNullKind = z
  .union([supportMacroKindFilterSchema, z.literal(""), z.null()])
  .transform((value) => (value === "" || value == null ? null : value))

export const createSupportMacroSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  body: z.string().trim().min(1, "Body is required").max(8000),
  kind_filter: emptyToNullKind.optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.coerce.number().int().min(0).max(9999).optional().default(0),
})

export const updateSupportMacroSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(120).optional(),
  body: z.string().trim().min(1, "Body is required").max(8000).optional(),
  kind_filter: emptyToNullKind.optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
})

export const deleteSupportMacroSchema = z.object({
  id: z.string().uuid(),
})

export const supportMacroOrderIdSchema = z.object({
  order_id: z.string().uuid(),
})

export type CreateSupportMacroInput = z.infer<typeof createSupportMacroSchema>
export type UpdateSupportMacroInput = z.infer<typeof updateSupportMacroSchema>
export type DeleteSupportMacroInput = z.infer<typeof deleteSupportMacroSchema>
export type SupportMacroKindFilter = (typeof SUPPORT_MACRO_KIND_FILTERS)[number]
