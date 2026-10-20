import { z } from "zod"
import { coerceSellListingPriceInput } from "@/lib/utils/sell-listing-price"

/** Publish payload price. Accepts `450`, `$450`, and `1,200`. */
export const sellListingPriceField = z.preprocess(
  coerceSellListingPriceInput,
  z.coerce.number().positive("Enter a price greater than $0"),
)
