import { revalidatePath, revalidateTag } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { SELLERS_DIRECTORY_CACHE_TAG } from "@/lib/cache/sellers-directory-catalog"

/** Bust cached `/sellers` directory tiles and all public seller profile pages. */
export function revalidateSellersDirectoryCatalog(): void {
  revalidateTag(SELLERS_DIRECTORY_CACHE_TAG, 'max')
  revalidatePath("/sellers", "layout")
}

/** Refresh one seller's public profile page plus the `/sellers` directory catalog. */
export async function revalidateSellerProfileAndDirectoryCatalog(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const trimmedId = userId.trim()
  if (!trimmedId) {
    revalidateSellersDirectoryCatalog()
    return
  }

  const { data } = await supabase
    .from("profiles")
    .select("seller_slug")
    .eq("id", trimmedId)
    .maybeSingle()

  const slug = typeof data?.seller_slug === "string" ? data.seller_slug.trim() : ""
  if (slug) {
    revalidatePath(`/sellers/${slug}`, "page")
  }
  revalidateSellersDirectoryCatalog()
}

/**
 * After a seller creates, updates, sells, archives, or relists inventory —
 * refresh their profile and the directory catalog.
 */
export async function revalidateSellersAfterListingChange(
  supabase: SupabaseClient,
  sellerUserId: string,
): Promise<void> {
  await revalidateSellerProfileAndDirectoryCatalog(supabase, sellerUserId)
}

/** Batch variant for cron/refunds/purges touching multiple sellers. */
export async function revalidateSellersForUserIds(
  supabase: SupabaseClient,
  userIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(userIds.map((id) => id.trim()).filter((id) => id.length > 0))]
  if (unique.length === 0) {
    revalidateSellersDirectoryCatalog()
    return
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("seller_slug")
    .in("id", unique)

  for (const row of profiles ?? []) {
    const slug = typeof row.seller_slug === "string" ? row.seller_slug.trim() : ""
    if (slug) {
      revalidatePath(`/sellers/${slug}`, "page")
    }
  }
  revalidateSellersDirectoryCatalog()
}
