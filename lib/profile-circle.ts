import { absoluteProxiedProfileMediaUrl, profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { absoluteUrl } from "@/lib/site-metadata"

/**
 * Solid banner blue (`SELLER_PROFILE_BANNER_DEFAULT` / `#5574AD`).
 * Profile circles use this when someone has no photo.
 */
export const STANDARD_PROFILE_AVATAR_PATH = "/images/reswell-profile-default.png"

export function standardProfileAvatarSrc(): string {
  return STANDARD_PROFILE_AVATAR_PATH
}

/** Website image src. A real photo when there is one, otherwise the banner-blue default. */
export function profileCircleSrc(avatarUrl: string | null | undefined): string {
  const display = profileMediaDisplaySrc(avatarUrl)
  return display || STANDARD_PROFILE_AVATAR_PATH
}

/** Absolute URL for the mobile API. Same photo-or-banner-blue rule as the website. */
export function absoluteProfileCircleUrl(avatarUrl: string | null | undefined): string {
  return absoluteProxiedProfileMediaUrl(avatarUrl) ?? absoluteUrl(STANDARD_PROFILE_AVATAR_PATH)
}
