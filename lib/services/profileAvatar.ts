import type { SupabaseClient } from "@supabase/supabase-js"

import {
  upsertAvatarWebp,
  updateProfileAvatarUrlRow,
  updateProfileShopLogoUrlRow,
  clearProfileAvatarUrlRow,
  clearProfileShopLogoUrlRow,
  removeAvatarObjectFromStorage,
  getProfileIsShop,
} from "@/lib/db/profileAvatar"
import { revalidateSellerProfileAndDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { processProfileAvatarToWebp } from "@/lib/services/profileAvatarImage"

export async function uploadProcessedProfileAvatar(params: {
  supabase: SupabaseClient
  userId: string
  file: File
}): Promise<{ avatarUrl: string }> {
  const { supabase, userId, file } = params

  const raw = Buffer.from(await file.arrayBuffer())
  const webp = await processProfileAvatarToWebp(raw, {
    originalFilename: file.name,
    mimeType: file.type,
  })

  const { publicUrl } = await upsertAvatarWebp(supabase, userId, webp)
  const avatarUrl = `${publicUrl}?t=${Date.now()}`
  await updateProfileAvatarUrlRow(supabase, userId, avatarUrl)

  const isShop = await getProfileIsShop(supabase, userId)
  if (isShop) {
    await updateProfileShopLogoUrlRow(supabase, userId, avatarUrl)
  }

  await revalidateSellerProfileAndDirectoryCatalog(supabase, userId)

  return { avatarUrl, shopLogoUrl: isShop ? avatarUrl : null }
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
