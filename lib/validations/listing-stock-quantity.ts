import { z } from "zod"
import {
  BRAND_NEW_LISTING_QUANTITY_MAX,
  BRAND_NEW_LISTING_QUANTITY_MIN,
} from "@/lib/listing-stock-quantity"

/** Optional on input. Brand-new listings persist this; other conditions ignore it. */
export const listingStockQuantityField = z.coerce
  .number()
  .int()
  .min(BRAND_NEW_LISTING_QUANTITY_MIN)
  .max(BRAND_NEW_LISTING_QUANTITY_MAX)
  .optional()
  .default(1)
