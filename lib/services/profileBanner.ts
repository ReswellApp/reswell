import type { SupabaseClient } from "@supabase/supabase-js"

import {
  upsertShopBannerWebp,
  updateProfileShopBannerUrlRow,
  clearProfileShopBannerUrlRow,
  removeShopBannerObjectFromStorage,
} from "@/lib/db/profileBanner"
import { revalidateSellerProfileAndDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { processProfileBannerToWebp } from "@/lib/services/profileBannerImage"

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
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)

  return { bannerUrl }
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
