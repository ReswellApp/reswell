import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

import {
  upsertShopBannerWebp,
  updateProfileShopBannerUrlRow,
  clearProfileShopBannerUrlRow,
  removeShopBannerObjectFromStorage,
} from "@/lib/db/profileBanner"
import { revalidateSellersDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { processProfileBannerToWebp } from "@/lib/services/profileBannerImage"

async function revalidateSellerProfilePaths(
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

export async function uploadProcessedProfileBanner(params: {
  supabase: SupabaseClient
  userId: string
  file: File
}): Promise<{ bannerUrl: string }> {
  const { supabase, userId, file } = params

  const raw = Buffer.from(await file.arrayBuffer())
  const webp = await processProfileBannerToWebp(raw, {
    originalFilename: file.name,
    mimeType: file.type,
  })

  const { publicUrl } = await upsertShopBannerWebp(supabase, userId, webp)
  const bannerUrl = `${publicUrl}?t=${Date.now()}`
  await updateProfileShopBannerUrlRow(supabase, userId, bannerUrl)
  await revalidateSellerProfilePaths(supabase, userId)

  return { bannerUrl }
}

export async function removeProfileBanner(params: {
  supabase: SupabaseClient
  userId: string
}): Promise<void> {
  const { supabase, userId } = params
  await clearProfileShopBannerUrlRow(supabase, userId)
  await removeShopBannerObjectFromStorage(supabase, userId)
  await revalidateSellerProfilePaths(supabase, userId)
}
