import { revalidatePath, revalidateTag } from "next/cache"
import { PRICE_GUIDE_CACHE_TAG } from "@/lib/cache/price-guide"

/** Bust cached `/priceguide` pages after sales, publishes, or editorial edits. */
export function revalidatePriceGuide(): void {
  revalidateTag(PRICE_GUIDE_CACHE_TAG, "max")
  revalidatePath("/priceguide", "layout")
}
