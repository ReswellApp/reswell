import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePublicStorageObjects } from "@/lib/cache/revalidate-public-storage-object"

const BUCKET = "avatars"

function objectPath(userId: string): string {
  return `${userId}/avatar.webp`
}

export async function upsertAvatarWebp(
  supabase: SupabaseClient,
  userId: string,
  webpBuffer: Buffer,
): Promise<{ publicUrl: string }> {
  const path = objectPath(userId)
  const { error } = await supabase.storage.from(BUCKET).upload(path, webpBuffer, {
    upsert: true,
    contentType: "image/webp",
    cacheControl: "31536000",
  })
  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { publicUrl }
}

export async function updateProfileAvatarUrlRow(
  supabase: SupabaseClient,
  userId: string,
  avatarUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
  if (error) throw error
}

export async function clearProfileAvatarUrlRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
  if (error) throw error
}

/** Best-effort cleanup after profile row no longer references the object. */
export async function removeAvatarObjectFromStorage(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const path = objectPath(userId)
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    console.warn("[profileAvatar] storage remove failed", { userId, message: error.message })
  } else {
    revalidatePublicStorageObjects(BUCKET, [path])
  }
}
