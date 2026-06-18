import { z } from "zod"

/** Max upload size before server-side resize to WebP (wide banner sources). */
export const PROFILE_BANNER_MAX_INPUT_BYTES = 10 * 1024 * 1024

export const profileBannerFocalSchema = z.object({
  focalX: z.number().min(0).max(100),
  focalY: z.number().min(0).max(100),
})

export type ProfileBannerFocalInput = z.infer<typeof profileBannerFocalSchema>
