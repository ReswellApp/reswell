import type { SupabaseClient } from "@supabase/supabase-js"

import {
  upsertAvatarWebp,
  updateProfileAvatarUrlRow,
  updateProfileAvatarFocalRow,
  updateProfileShopLogoUrlRow,
  clearProfileAvatarUrlRow,
  clearProfileShopLogoUrlRow,
  removeAvatarObjectFromStorage,
  getProfileIsShop,
} from "@/lib/db/profileAvatar"
import { revalidateSellerProfileAndDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { PROFILE_BANNER_FOCAL_DEFAULT } from "@/lib/utils/profile-banner-focal"
import { processProfileAvatarSourceToWebp } from "@/lib/services/profileAvatarImage"

export async function uploadProcessedProfileAvatar(params: {
  supabase: SupabaseClient
  userId: string
  file: File
}): Promise<{ avatarUrl: string; focalX: number; focalY: number; shopLogoUrl: string | null }> {
  const { supabase, userId, file } = params

  const raw = Buffer.from(await file.arrayBuffer())
  const webp = await processProfileAvatarSourceToWebp(raw, {
    originalFilename: file.name,
    mimeType: file.type,
  })

  const { publicUrl } = await upsertAvatarWebp(supabase, userId, webp)
  const avatarUrl = `${publicUrl}?t=${Date.now()}`
  await updateProfileAvatarUrlRow(supabase, userId, avatarUrl, { resetFocal: true })

  const isShop = await getProfileIsShop(supabase, userId)
  if (isShop) {
    await updateProfileShopLogoUrlRow(supabase, userId, avatarUrl)
  }

  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)

  return {
    avatarUrl,
    focalX: PROFILE_BANNER_FOCAL_DEFAULT.x,
    focalY: PROFILE_BANNER_FOCAL_DEFAULT.y,
    shopLogoUrl: isShop ? avatarUrl : null,
  }
}

export async function updateProfileAvatarFocal(params: {
  supabase: SupabaseClient
  userId: string
  focal: { x: number; y: number }
}): Promise<{ focalX: number; focalY: number }> {
  const { supabase, userId, focal } = params
  await updateProfileAvatarFocalRow(supabase, userId, focal)
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)
  return { focalX: focal.x, focalY: focal.y }
}

export async function removeProfileAvatar(params: {
  supabase: SupabaseClient
  userId: string
}): Promise<void> {
  const { supabase, userId } = params
  const isShop = await getProfileIsShop(supabase, userId)

  await clearProfileAvatarUrlRow(supabase, userId)
  if (isShop) {
    await clearProfileShopLogoUrlRow(supabase, userId)
  }
  await removeAvatarObjectFromStorage(supabase, userId)
  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)
}
