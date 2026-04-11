import { z } from "zod"

const fulfillment = z.enum(["pickup_only", "shipping_only", "pickup_and_shipping"])
const shippingCostMode = z.enum(["reswell", "free", "flat"])

/** Relaxed payload from the sell form for server-side draft persistence. */
export const listingDraftAutosaveSchema = z.object({
  listingId: z.string().uuid().optional().nullable(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  condition: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  boardFulfillment: fulfillment.optional(),
  boardShippingCostMode: shippingCostMode.optional(),
  boardShippingPrice: z.string().optional(),
  autoPriceDrop: z.boolean().optional(),
  autoPriceDropFloor: z.string().optional(),
  buyerOffers: z.boolean().optional(),
  boardType: z.string().optional(),
  boardLength: z.string().optional(),
  boardLengthFt: z.string().optional(),
  boardLengthIn: z.string().optional(),
  boardWidthInches: z.string().optional(),
  boardThicknessInches: z.string().optional(),
  boardVolumeL: z.string().optional(),
  boardFins: z.string().optional(),
  boardTail: z.string().optional(),
  boardBrandId: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
})

export type ListingDraftAutosaveInput = z.infer<typeof listingDraftAutosaveSchema>
