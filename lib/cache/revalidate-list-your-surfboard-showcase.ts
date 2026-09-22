import { revalidatePath, revalidateTag } from "next/cache"
import { LIST_YOUR_SURFBOARD_SHOWCASE_CACHE_TAG } from "@/lib/cache/list-your-surfboard-showcase"

/** Bust cached `/listyoursurfboard` hero slides + showcase reviews. */
export function revalidateListYourSurfboardShowcase(): void {
  revalidateTag(LIST_YOUR_SURFBOARD_SHOWCASE_CACHE_TAG, "max")
  revalidatePath("/listyoursurfboard", "page")
}
