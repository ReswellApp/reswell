import type { SupabaseClient } from "@supabase/supabase-js"

import {
  uploadShopTileBannerWebp,
  updateProfileShopTileBannerUrlRow,
  updateProfileShopTileBannerFocalRow,
  clearProfileShopTileBannerUrlRow,
  removeShopTileBannerObjectFromStorage,
  getProfileShopTileBannerUrl,
} from "@/lib/db/profileTileBanner"
import { revalidateSellerProfileAndDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { processProfileBannerSourceToWebp } from "@/lib/services/profileBannerImage"
import { PROFILE_BANNER_FOCAL_DEFAULT } from "@/lib/utils/profile-banner-focal"

export async function uploadProcessedProfileTileBanner(params: {
  supabase: SupabaseClient
  userId: string
  file: File
}): Promise<{ bannerUrl: string; focalX: number; focalY: number }> {
  const { supabase, userId, file } = params

  const previousBannerUrl = await getProfileShopTileBannerUrl(supabase, userId)

  const raw = Buffer.from(await file.arrayBuffer())
  const webp = await processProfileBannerSourceToWebp(raw, {
    originalFilename: file.name,
    mimeType: file.type,
  })

  const { publicUrl } = await uploadShopTileBannerWebp(supabase, userId, webp)
  const bannerUrl = `${publicUrl}?t=${Date.now()}`
  const focal = PROFILE_BANNER_FOCAL_DEFAULT
  await updateProfileShopTileBannerUrlRow(supabase, userId, bannerUrl, focal)

  await removeShopTileBannerObjectFromStorage(supabase, userId, previousBannerUrl)
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)

  return { bannerUrl, focalX: focal.x, focalY: focal.y }
}

export async function updateProfileTileBannerFocal(params: {
  supabase: SupabaseClient
  userId: string
  focal: { x: number; y: number }
}): Promise<{ focalX: number; focalY: number }> {
  const { supabase, userId, focal } = params
  await updateProfileShopTileBannerFocalRow(supabase, userId, focal)
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)
  return { focalX: focal.x, focalY: focal.y }
}

export async function removeProfileTileBanner(params: {
  supabase: SupabaseClient
  userId: string
}): Promise<void> {
  const { supabase, userId } = params
  const previousBannerUrl = await getProfileShopTileBannerUrl(supabase, userId)
  await clearProfileShopTileBannerUrlRow(supabase, userId)
  await removeShopTileBannerObjectFromStorage(supabase, userId, previousBannerUrl)
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)
}
