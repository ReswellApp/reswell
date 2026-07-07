import { z } from "zod"

export const ADMIN_LISTING_SECTIONS = [
  "surfboards",
  "new",
  "fins",
  "wetsuits",
  "boardbags",
  "surfpacks",
  "leashes",
  "apparel",
  "accessories",
  "magazines",
] as const

export type AdminListingSection = (typeof ADMIN_LISTING_SECTIONS)[number]

export const adminListingCategoryBodySchema = z.object({
  section: z.enum(ADMIN_LISTING_SECTIONS),
  category_id: z.string().uuid(),
})
