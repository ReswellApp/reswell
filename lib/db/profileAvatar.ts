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

  revalidatePublicStorageObjects(BUCKET, [path])

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { publicUrl }
}

export async function updateProfileAvatarUrlRow(
  supabase: SupabaseClient,
  userId: string,
  avatarUrl: string,
  opts?: { resetFocal?: boolean },
): Promise<void> {
  const patch: Record<string, string | number | null> = {
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
  }
  if (opts?.resetFocal) {
    patch.avatar_focal_x_pct = 50
    patch.avatar_focal_y_pct = 50
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId)
  if (error) throw error
}

export async function updateProfileAvatarFocalRow(
  supabase: SupabaseClient,
  userId: string,
  focal: { x: number; y: number },
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_focal_x_pct: focal.x,
      avatar_focal_y_pct: focal.y,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
  if (error) throw error
}

export async function updateProfileShopLogoUrlRow(
  supabase: SupabaseClient,
  userId: string,
  shopLogoUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      shop_logo_url: shopLogoUrl,
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
      avatar_focal_x_pct: null,
      avatar_focal_y_pct: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
  if (error) throw error
}

export async function clearProfileShopLogoUrlRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      shop_logo_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
  if (error) throw error
}

export async function getProfileIsShop(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_shop")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  return data?.is_shop === true
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
