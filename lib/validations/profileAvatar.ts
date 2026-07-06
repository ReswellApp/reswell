/** Max upload size before server-side resize to WebP (larger sources for quality). */
export const PROFILE_AVATAR_MAX_INPUT_BYTES = 10 * 1024 * 1024

export { profileBannerFocalSchema as profileAvatarFocalSchema } from "@/lib/validations/profileBanner"
export type { ProfileBannerFocalInput as ProfileAvatarFocalInput } from "@/lib/validations/profileBanner"
