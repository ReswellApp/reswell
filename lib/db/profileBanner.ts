import type { SupabaseClient } from "@supabase/supabase-js"
import { avatarsStorageObjectPathFromUrl } from "@/lib/avatar-media-proxy-url"
import { revalidatePublicStorageObjects } from "@/lib/cache/revalidate-public-storage-object"

const BUCKET = "avatars"

/** Legacy fixed key — still cleaned up on replace/remove for older banners. */
function legacyObjectPath(userId: string): string {
  return `${userId}/shop-banner.webp`
}

/** Content-addressed key so `/media/avatars` never serves stale bytes for a replaced banner. */
function versionedObjectPath(userId: string): string {
  return `${userId}/shop-banner-${Date.now()}.webp`
}

export async function uploadShopBannerWebp(
  supabase: SupabaseClient,
  userId: string,
  webpBuffer: Buffer,
): Promise<{ publicUrl: string; objectPath: string }> {
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
  return { publicUrl, objectPath: path }
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

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("shop_banner_url")
    .maybeSingle()

  if (error) throw error
  if (!data?.shop_banner_url) {
    throw new Error("Shop banner URL was not persisted")
  }
}

export async function updateProfileShopBannerFocalRow(
  supabase: SupabaseClient,
  userId: string,
  focal: { x: number; y: number },
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      shop_banner_focal_x_pct: focal.x,
      shop_banner_focal_y_pct: focal.y,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error("Shop banner focal point was not persisted")
  }
}

export async function clearProfileShopBannerUrlRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      shop_banner_url: null,
      shop_banner_focal_x_pct: null,
      shop_banner_focal_y_pct: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error("Shop banner was not cleared")
  }
}

export async function getProfileShopBannerUrl(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("shop_banner_url")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  const url = typeof data?.shop_banner_url === "string" ? data.shop_banner_url.trim() : ""
  return url || null
}

function bannerObjectPathsToRemove(userId: string, bannerUrl: string | null | undefined): string[] {
  const paths = new Set<string>([legacyObjectPath(userId)])
  if (bannerUrl) {
    const fromUrl = avatarsStorageObjectPathFromUrl(bannerUrl)
    if (fromUrl) paths.add(fromUrl)
  }
  return [...paths]
}

/** Best-effort cleanup after profile row no longer references the object. */
export async function removeShopBannerObjectFromStorage(
  supabase: SupabaseClient,
  userId: string,
  bannerUrl?: string | null,
): Promise<void> {
  const paths = bannerObjectPathsToRemove(userId, bannerUrl)
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) {
    console.warn("[profileBanner] storage remove failed", { userId, message: error.message })
  } else {
    revalidatePublicStorageObjects(BUCKET, paths, { expireImmediately: true })
  }
}
