import type { SupabaseClient } from "@supabase/supabase-js"

import {
  upsertAvatarWebp,
  updateProfileAvatarUrlRow,
  clearProfileAvatarUrlRow,
  removeAvatarObjectFromStorage,
} from "@/lib/db/profileAvatar"
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

  return { avatarUrl }
}

export async function removeProfileAvatar(params: {
  supabase: SupabaseClient
  userId: string
}): Promise<void> {
  const { supabase, userId } = params
  await clearProfileAvatarUrlRow(supabase, userId)
  await removeAvatarObjectFromStorage(supabase, userId)
}
