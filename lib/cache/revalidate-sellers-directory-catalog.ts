import { revalidatePath, revalidateTag } from "next/cache"
import { SELLERS_DIRECTORY_CACHE_TAG } from "@/lib/cache/sellers-directory-catalog"

/** Bust cached `/sellers` directory tiles after profile, listing, or ordering changes. */
export function revalidateSellersDirectoryCatalog(): void {
  revalidateTag(SELLERS_DIRECTORY_CACHE_TAG)
  revalidatePath("/sellers", "page")
}
