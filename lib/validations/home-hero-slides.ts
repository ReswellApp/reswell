import { z } from "zod"

export const adminHomeHeroSlideBodySchema = z.object({
  image_url: z
    .string()
    .trim()
    .min(1)
    .url()
    .refine((u) => u.startsWith("https:"), "Image URL must use HTTPS"),
})

export type AdminHomeHeroSlideBody = z.infer<typeof adminHomeHeroSlideBodySchema>
