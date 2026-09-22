import type { SupabaseClient } from "@supabase/supabase-js"
import { avatarsStorageObjectPathFromUrl } from "@/lib/avatar-media-proxy-url"
import { revalidatePublicStorageObjects } from "@/lib/cache/revalidate-public-storage-object"

const BUCKET = "avatars"

function versionedObjectPath(userId: string): string {
  return `${userId}/shop-tile-banner-${Date.now()}.webp`
}

export async function uploadShopTileBannerWebp(
  supabase: SupabaseClient,
  userId: string,
  webpBuffer: Buffer,
): Promise<{ publicUrl: string }> {
  const path = versionedObjectPath(userId)
  const { error } = await supabase.storage.from(BUCKET).upload(path, webpBuffer, {
    upsert: false,
    contentType: "image/webp",
    cacheControl: "31536000",
  })
  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { publicUrl }
}

export async function updateProfileShopTileBannerUrlRow(
  supabase: SupabaseClient,
  userId: string,
  shopTileBannerUrl: string,
  focal?: { x: number; y: number },
): Promise<void> {
  const patch: Record<string, string | number | null> = {
    shop_tile_banner_url: shopTileBannerUrl,
    updated_at: new Date().toISOString(),
  }
  if (focal) {
    patch.shop_tile_banner_focal_x_pct = focal.x
    patch.shop_tile_banner_focal_y_pct = focal.y
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("shop_tile_banner_url")
    .maybeSingle()

  if (error) throw error
  if (!data?.shop_tile_banner_url) {
    throw new Error("Shop tile banner URL was not persisted")
  }
}

export async function updateProfileShopTileBannerFocalRow(
  supabase: SupabaseClient,
  userId: string,
  focal: { x: number; y: number },
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      shop_tile_banner_focal_x_pct: focal.x,
      shop_tile_banner_focal_y_pct: focal.y,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error("Shop tile banner focal point was not persisted")
  }
}

export async function clearProfileShopTileBannerUrlRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      shop_tile_banner_url: null,
      shop_tile_banner_focal_x_pct: null,
      shop_tile_banner_focal_y_pct: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error("Shop tile banner was not cleared")
  }
}

export async function getProfileShopTileBannerUrl(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("shop_tile_banner_url")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  const url = typeof data?.shop_tile_banner_url === "string" ? data.shop_tile_banner_url.trim() : ""
  return url || null
}

export async function removeShopTileBannerObjectFromStorage(
  supabase: SupabaseClient,
  userId: string,
  bannerUrl?: string | null,
): Promise<void> {
  const paths = new Set<string>()
  if (bannerUrl) {
    const fromUrl = avatarsStorageObjectPathFromUrl(bannerUrl)
    if (fromUrl && fromUrl.includes("shop-tile-banner")) paths.add(fromUrl)
  }
  if (paths.size === 0) return
  const list = [...paths]
  const { error } = await supabase.storage.from(BUCKET).remove(list)
  if (error) {
    console.warn("[profileTileBanner] storage remove failed", { userId, message: error.message })
  } else {
    revalidatePublicStorageObjects(BUCKET, list, { expireImmediately: true })
  }
}
