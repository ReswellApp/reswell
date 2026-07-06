import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePublicStorageObjects } from "@/lib/cache/revalidate-public-storage-object"

const BUCKET = "avatars"

function objectPath(userId: string): string {
  return `${userId}/shop-banner.webp`
}

export async function upsertShopBannerWebp(
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

export async function updateProfileShopBannerUrlRow(
  supabase: SupabaseClient,
  userId: string,
  shopBannerUrl: string,
  focal?: { x: number; y: number },
): Promise<void> {
  const patch: Record<string, string | number | null> = {
    shop_banner_url: shopBannerUrl,
    updated_at: new Date().toISOString(),
  }
  if (focal) {
    patch.shop_banner_focal_x_pct = focal.x
    patch.shop_banner_focal_y_pct = focal.y
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId)
  if (error) throw error
}

export async function updateProfileShopBannerFocalRow(
  supabase: SupabaseClient,
  userId: string,
  focal: { x: number; y: number },
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      shop_banner_focal_x_pct: focal.x,
      shop_banner_focal_y_pct: focal.y,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
  if (error) throw error
}

export async function clearProfileShopBannerUrlRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      shop_banner_url: null,
      shop_banner_focal_x_pct: null,
      shop_banner_focal_y_pct: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
  if (error) throw error
}

/** Best-effort cleanup after profile row no longer references the object. */
export async function removeShopBannerObjectFromStorage(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const path = objectPath(userId)
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    console.warn("[profileBanner] storage remove failed", { userId, message: error.message })
  } else {
    revalidatePublicStorageObjects(BUCKET, [path])
  }
}
