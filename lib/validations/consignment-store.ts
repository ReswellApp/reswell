import { z } from "zod"
import { commissionBpsSchema } from "@/lib/validations/consignment"

/** Admin creates a consignment store for a user who already holds the consignment-shop role. */
export const createConsignmentStoreSchema = z.object({
  ownerProfileId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  name: z.string().trim().min(1).max(120),
  defaultCommissionBps: commissionBpsSchema,
  reswellFeeBps: z.number().int().min(0).max(5000).optional(),
})

export type CreateConsignmentStoreInput = z.infer<typeof createConsignmentStoreSchema>

export const transferConsignmentStoreOwnerSchema = z.object({
  newOwnerProfileId: z.string().uuid(),
})
