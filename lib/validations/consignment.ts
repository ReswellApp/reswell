import { z } from "zod"
import { MIN_SHOP_COMMISSION_BPS } from "@/lib/services/consignmentSplit"

/** Commission/fee rates are basis points (700 = 7%). Shop must take at least the Reswell fee. */
export const commissionBpsSchema = z
  .number()
  .int()
  .min(MIN_SHOP_COMMISSION_BPS, "Commission must be at least the Reswell fee")
  .max(9000, "Commission cannot exceed 90%")

const priceSchema = z.coerce.number().finite().min(0)

const LISTING_CONDITIONS = [
  "brand_new",
  "excellent",
  "very_good",
  "good",
  "fair",
  "poor",
] as const

/** Consignor submits a board through a store's QR intake. Shop sets asking price on approval. */
export const consignmentIntakeSubmitSchema = z
  .object({
    storeId: z.string().uuid(),
    title: z.string().trim().min(3, "Add a title").max(140),
    description: z.string().trim().min(10, "Add a short description").max(4000),
    condition: z.enum(LISTING_CONDITIONS),
    boardType: z.string().trim().max(60).optional(),
    dimensions: z.string().trim().max(120).optional(),
    photoUrls: z.array(z.string().url()).min(1, "Add at least one photo").max(12),
    consignorProposedPrice: priceSchema,
    floorPrice: priceSchema,
    termsAccepted: z.literal(true),
  })
  .superRefine((data, ctx) => {
    if (data.floorPrice > data.consignorProposedPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Floor price cannot exceed your proposed price",
        path: ["floorPrice"],
      })
    }
  })

/** Shop staff approves an intake: confirms the live asking price and commission. */
export const consignmentIntakeApproveSchema = z
  .object({
    intakeId: z.string().uuid(),
    askingPrice: priceSchema.refine((v) => v > 0, "Asking price must be greater than 0"),
    commissionBps: commissionBpsSchema,
  })

/** Store owner updates store-level commission default + status + Terminal location. */
export const consignmentStoreSettingsSchema = z.object({
  storeId: z.string().uuid(),
  defaultCommissionBps: commissionBpsSchema,
  status: z.enum(["active", "paused"]),
  stripeTerminalLocationId: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .nullable(),
})

/** Non-owner staff roles an owner can assign (the owner role is implicit on the store record). */
export const storeStaffRoleSchema = z.enum(["manager", "clerk"])

/** Store owner adds a staff member by their Reswell account email. */
export const addStoreStaffSchema = z.object({
  storeId: z.string().uuid(),
  email: z.string().trim().email("Valid email required"),
  role: storeStaffRoleSchema,
})

/** Store owner removes a staff member. */
export const removeStoreStaffSchema = z.object({
  storeId: z.string().uuid(),
  profileId: z.string().uuid(),
})

/** Shop re-prices an active consigned listing (must stay at or above the consignor's floor). */
export const repriceConsignmentSchema = z.object({
  listingId: z.string().uuid(),
  price: priceSchema.refine((v) => v > 0, "Price must be greater than 0"),
})

/** Shop withdraws/returns a consigned board: takes it off sale (no money moves). */
export const withdrawConsignmentSchema = z.object({
  listingId: z.string().uuid(),
})

/**
 * Shop records a sale that happened off Reswell (cash on the floor, the consignor's own channel).
 * Marks the board sold for inventory/history; no Reswell payout is created — the shop settles the
 * consignor directly.
 */
export const recordOffPlatformSaleSchema = z.object({
  listingId: z.string().uuid(),
  salePrice: priceSchema.refine((v) => v > 0, "Sale price must be greater than 0"),
})

/** POS captures a walk-in customer to the shop's customer list (no Reswell account required). */
export const storeCustomerCaptureSchema = z.object({
  storeId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Valid email required"),
  phoneE164: z.string().trim().max(20).optional(),
})

/** POS: start an in-store card-present sale of a consigned board on a chosen reader. */
export const posSaleStartSchema = z.object({
  storeId: z.string().uuid(),
  listingId: z.string().uuid(),
  readerId: z.string().trim().min(1, "Select a reader"),
  customer: storeCustomerCaptureSchema
    .omit({ storeId: true })
    .extend({ email: z.string().trim().email().optional() })
    .partial()
    .optional(),
})

/** POS: finalize/settle a sale after the reader reports success (also runs via webhook). */
export const posSaleFinalizeSchema = z.object({
  paymentIntentId: z.string().trim().min(1),
})

/** POS: settle an in-store sale paid in cash (no card reader / PaymentIntent). */
export const posCashSaleSchema = z.object({
  storeId: z.string().uuid(),
  listingId: z.string().uuid(),
  customer: storeCustomerCaptureSchema
    .omit({ storeId: true })
    .extend({ email: z.string().trim().email().optional() })
    .partial()
    .optional(),
})

export type ConsignmentIntakeSubmitInput = z.infer<typeof consignmentIntakeSubmitSchema>
export type ConsignmentIntakeApproveInput = z.infer<typeof consignmentIntakeApproveSchema>
export type StoreCustomerCaptureInput = z.infer<typeof storeCustomerCaptureSchema>
export type PosSaleStartInput = z.infer<typeof posSaleStartSchema>
export type PosSaleFinalizeInput = z.infer<typeof posSaleFinalizeSchema>
export type PosCashSaleInput = z.infer<typeof posCashSaleSchema>
export type ConsignmentStoreSettingsInput = z.infer<typeof consignmentStoreSettingsSchema>
export type AddStoreStaffInput = z.infer<typeof addStoreStaffSchema>
export type RemoveStoreStaffInput = z.infer<typeof removeStoreStaffSchema>
export type StoreStaffRole = z.infer<typeof storeStaffRoleSchema>
export type RepriceConsignmentInput = z.infer<typeof repriceConsignmentSchema>
export type WithdrawConsignmentInput = z.infer<typeof withdrawConsignmentSchema>
export type RecordOffPlatformSaleInput = z.infer<typeof recordOffPlatformSaleSchema>
