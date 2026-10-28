import { absoluteProxiedProfileMediaUrl, profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { absoluteUrl } from "@/lib/site-metadata"

/** Public default avatar when a profile has no photo. */
export const STANDARD_PROFILE_AVATAR_PATH = "/images/reswell-profile-default.png"

export function standardProfileAvatarSrc(): string {
  return STANDARD_PROFILE_AVATAR_PATH
}

export function isStandardProfileAvatarUrl(url: string | null | undefined): boolean {
  const trimmed = typeof url === "string" ? url.trim() : ""
  if (!trimmed) return true
  return trimmed.includes(STANDARD_PROFILE_AVATAR_PATH)
}

/** Resolved user photo URL, or null when the profile should show the default avatar. */
export function userProfilePhotoDisplaySrc(avatarUrl: string | null | undefined): string | null {
  if (isStandardProfileAvatarUrl(avatarUrl)) return null
  const display = profileMediaDisplaySrc(avatarUrl)
  return display || null
}

/** Website image src. A real photo when there is one, otherwise the default avatar. */
export function profileCircleSrc(avatarUrl: string | null | undefined): string {
  return userProfilePhotoDisplaySrc(avatarUrl) ?? STANDARD_PROFILE_AVATAR_PATH
}

/** Absolute URL for the mobile API. Same photo-or-default rule as the website. */
export function absoluteProfileCircleUrl(avatarUrl: string | null | undefined): string {
  return absoluteProxiedProfileMediaUrl(avatarUrl) ?? absoluteUrl(STANDARD_PROFILE_AVATAR_PATH)
}
