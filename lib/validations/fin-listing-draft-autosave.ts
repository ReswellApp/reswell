import { z } from "zod"

const shippingCostMode = z.enum(["reswell", "free", "flat"])

/** Relaxed payload from the fin sell form for server-side draft persistence. */
export const finListingDraftAutosaveSchema = z.object({
  listingId: z.string().uuid().optional().nullable(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  sellerPurchasePrice: z.string().optional(),
  condition: z.string().optional(),
  size: z.string().optional().nullable(),
  finSetup: z.string().optional().nullable(),
  finSystem: z.string().optional().nullable(),
  brand: z.string().optional(),
  brandId: z.string().uuid().optional().nullable(),
  model: z.string().optional(),
  brandModelId: z.string().uuid().optional().nullable(),
  locationLat: z.number().optional().nullable(),
  locationLng: z.number().optional().nullable(),
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
