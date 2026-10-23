import { z } from "zod"
import {
  draftOptionalCoord,
  draftOptionalDate,
  draftOptionalListingId,
  draftOptionalMoney,
  draftOptionalUuid,
} from "@/lib/validations/listing-draft-fields"

const shippingCostMode = z.enum(["reswell", "free", "flat"])

/** Relaxed payload from the fin sell form for server-side draft persistence. */
export const finListingDraftAutosaveSchema = z.object({
  listingId: draftOptionalListingId.optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: draftOptionalMoney,
  sellerPurchasePrice: draftOptionalMoney,
  sellerPurchasedFrom: z.string().max(200).optional(),
  sellerPurchasedOn: draftOptionalDate.optional(),
  condition: z.string().optional(),
  stockQuantity: z.union([z.string(), z.number()]).optional(),
  size: z.string().optional().nullable(),
  finSetup: z.string().optional().nullable(),
  finSystem: z.string().optional().nullable(),
  brand: z.string().optional(),
  brandId: draftOptionalUuid.optional(),
  model: z.string().optional(),
  brandModelId: draftOptionalUuid.optional(),
  locationLat: draftOptionalCoord,
  locationLng: draftOptionalCoord,
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  shippingCostMode: shippingCostMode.optional(),
  shippingPrice: z.string().optional(),
  reswellPackageLengthIn: z.string().optional(),
  reswellPackageWidthIn: z.string().optional(),
  reswellPackageHeightIn: z.string().optional(),
  reswellPackageWeightLb: z.string().optional(),
  reswellPackageWeightOz: z.string().optional(),
  buyerOffers: z.boolean().optional(),
})

export type FinListingDraftAutosaveInput = z.infer<typeof finListingDraftAutosaveSchema>
