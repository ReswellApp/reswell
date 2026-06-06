import { revalidatePath, revalidateTag } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { SELLERS_DIRECTORY_CACHE_TAG } from "@/lib/cache/sellers-directory-catalog"

/** Bust cached `/sellers` directory tiles after profile, listing, or ordering changes. */
export function revalidateSellersDirectoryCatalog(): void {
  revalidateTag(SELLERS_DIRECTORY_CACHE_TAG)
  revalidatePath("/sellers", "page")
}

/** Refresh `/sellers` and the seller's public profile after profile/media updates. */
export async function revalidateSellerProfileAndDirectoryCatalog(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("seller_slug")
    .eq("id", userId)
    .maybeSingle()

  const slug = typeof data?.seller_slug === "string" ? data.seller_slug.trim() : ""
  if (slug) {
    revalidatePath(`/sellers/${slug}`, "page")
  }
  revalidateSellersDirectoryCatalog()
}
