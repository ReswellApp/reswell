import type { SupabaseClient } from "@supabase/supabase-js"

import {
  upsertShopBannerWebp,
  updateProfileShopBannerUrlRow,
  updateProfileShopBannerFocalRow,
  clearProfileShopBannerUrlRow,
  removeShopBannerObjectFromStorage,
} from "@/lib/db/profileBanner"
import { revalidateSellerProfileAndDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { processProfileBannerSourceToWebp } from "@/lib/services/profileBannerImage"
import { PROFILE_BANNER_FOCAL_DEFAULT } from "@/lib/utils/profile-banner-focal"

export async function uploadProcessedProfileBanner(params: {
  supabase: SupabaseClient
  userId: string
  file: File
}): Promise<{ bannerUrl: string; focalX: number; focalY: number }> {
  const { supabase, userId, file } = params

  const raw = Buffer.from(await file.arrayBuffer())
  const webp = await processProfileBannerSourceToWebp(raw, {
    originalFilename: file.name,
    mimeType: file.type,
  })

  const { publicUrl } = await upsertShopBannerWebp(supabase, userId, webp)
  const bannerUrl = `${publicUrl}?t=${Date.now()}`
  const focal = PROFILE_BANNER_FOCAL_DEFAULT
  await updateProfileShopBannerUrlRow(supabase, userId, bannerUrl, focal)
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)

  return { bannerUrl, focalX: focal.x, focalY: focal.y }
}

export async function updateProfileBannerFocal(params: {
  supabase: SupabaseClient
  userId: string
  focal: { x: number; y: number }
}): Promise<{ focalX: number; focalY: number }> {
  const { supabase, userId, focal } = params
  await updateProfileShopBannerFocalRow(supabase, userId, focal)
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)
  return { focalX: focal.x, focalY: focal.y }
}

export async function removeProfileBanner(params: {
  supabase: SupabaseClient
  userId: string
}): Promise<void> {
  const { supabase, userId } = params
  await clearProfileShopBannerUrlRow(supabase, userId)
  await removeShopBannerObjectFromStorage(supabase, userId)
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)
}
