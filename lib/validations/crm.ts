import { z } from "zod"

export const crmContactStatusSchema = z.enum(["lead", "prospect", "active", "customer", "inactive"])
export const crmContactPrioritySchema = z.enum(["low", "medium", "high"])
export const crmContactSourceSchema = z.enum(["profile", "external"])
export const crmBoardInterestTypeSchema = z.enum(["listing", "catalog_model", "custom"])
export const crmBoardInterestStatusSchema = z.enum([
  "interested",
  "contacted",
  "matched",
  "fulfilled",
  "lost",
])
export const crmInteractionTypeSchema = z.enum(["call", "email", "text", "in_person", "note", "other"])

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email")
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v))
  .optional()

const optionalIsoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v))
  .optional()

const optionalBudget = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (v === "" || v == null) return undefined
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : undefined
  })
  .optional()

export const createCrmContactFromProfileSchema = z.object({
  profileId: z.string().uuid(),
})

export const createCrmExternalContactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: optionalText,
  email: optionalEmail,
  phone: optionalText,
  status: crmContactStatusSchema.optional().default("lead"),
  priority: crmContactPrioritySchema.optional().default("medium"),
  notes: optionalText,
  nextFollowUpAt: optionalIsoDate,
})

export const updateCrmContactSchema = z.object({
  contactId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.union([z.string().trim().max(80), z.null()]).optional(),
  email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional(),
  phone: z.union([z.string().trim().max(40), z.null()]).optional(),
  status: crmContactStatusSchema.optional(),
  priority: crmContactPrioritySchema.optional(),
  notes: z.union([z.string().trim().max(5000), z.null()]).optional(),
  nextFollowUpAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
})

export const deleteCrmContactSchema = z.object({
  contactId: z.string().uuid(),
})

export const createCrmBoardInterestSchema = z
  .object({
    contactId: z.string().uuid(),
    interestType: crmBoardInterestTypeSchema,
    listingId: z.string().uuid().optional(),
    brandModelId: z.string().uuid().optional(),
    customDescription: optionalText,
    brand: optionalText,
    model: optionalText,
    dimensions: optionalText,
    budgetMin: optionalBudget,
    budgetMax: optionalBudget,
    status: crmBoardInterestStatusSchema.optional().default("interested"),
    notes: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.interestType === "listing" && !data.listingId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a listing", path: ["listingId"] })
    }
    if (data.interestType === "catalog_model" && !data.brandModelId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a catalog model", path: ["brandModelId"] })
    }
    if (data.interestType === "custom" && !data.customDescription?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the board they want",
        path: ["customDescription"],
      })
    }
  })

export const updateCrmBoardInterestSchema = z.object({
  interestId: z.string().uuid(),
  status: crmBoardInterestStatusSchema.optional(),
  notes: z.union([z.string().trim().max(2000), z.null()]).optional(),
  customDescription: z.string().trim().min(1).max(500).optional(),
  brand: z.union([z.string().trim().max(120), z.null()]).optional(),
  model: z.union([z.string().trim().max(120), z.null()]).optional(),
  dimensions: z.union([z.string().trim().max(80), z.null()]).optional(),
  budgetMin: z.union([z.number().nonnegative(), z.null()]).optional(),
  budgetMax: z.union([z.number().nonnegative(), z.null()]).optional(),
})

export const deleteCrmBoardInterestSchema = z.object({
  interestId: z.string().uuid(),
})

export const logCrmInteractionSchema = z.object({
  contactId: z.string().uuid(),
  interactionType: crmInteractionTypeSchema,
  subject: optionalText,
  notes: z.string().trim().min(1, "Add notes about this touchpoint").max(5000),
})

export const markCrmContactedSchema = z.object({
  contactId: z.string().uuid(),
  nextFollowUpAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
})
