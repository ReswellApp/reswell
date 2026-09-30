import { z } from "zod"

export const listingAcquisitionFieldShape = {
  sellerPurchasePrice: z.coerce.number().nonnegative().nullable().optional(),
  sellerPurchasedFrom: z.string().trim().max(200).nullable().optional(),
  sellerPurchasedOn: z.string().date().nullable().optional(),
}
