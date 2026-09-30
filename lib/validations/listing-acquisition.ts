import { z } from "zod"

export const listingAcquisitionFieldShape = {
  sellerPurchasePrice: z.coerce.number().nonnegative().nullable().optional(),
  sellerPurchasedFrom: z.string().trim().max(200).nullable().optional(),
  sellerPurchasedOn: z.string().date().nullable().optional(),
}

const emptyToNull = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? null : value

export const updateListingAcquisitionSchema = z.object({
  listingId: z.string().uuid(),
  purchasePrice: z.preprocess(
    emptyToNull,
    z.coerce.number().nonnegative().max(999_999.99).nullable(),
  ),
  purchasedFrom: z.preprocess(
    emptyToNull,
    z.string().trim().max(200).nullable(),
  ),
  purchasedOn: z.preprocess(
    emptyToNull,
    z.string().date().nullable(),
  ),
})

export type UpdateListingAcquisitionInput = z.infer<
  typeof updateListingAcquisitionSchema
>
