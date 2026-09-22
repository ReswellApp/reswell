import { z } from "zod"
import { ADMIN_LISTING_STATUS_VALUES } from "@/lib/validations/admin-listing-status"

export const ADMIN_LISTING_LIST_SECTIONS = [
  "all",
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
  "traction",
] as const

export const ADMIN_LISTING_LIST_SORTS = ["created_at", "price", "views", "title"] as const

export const adminListingsListQuerySchema = z.object({
  status: z.enum(["all", ...ADMIN_LISTING_STATUS_VALUES]).optional().default("all"),
  section: z.enum(ADMIN_LISTING_LIST_SECTIONS).optional().default("all"),
  visibility: z.enum(["all", "visible", "hidden"]).optional().default("all"),
  q: z.string().trim().max(200).optional().default(""),
  sort: z.enum(ADMIN_LISTING_LIST_SORTS).optional().default("created_at"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).max(100_000).optional().default(0),
})

export type AdminListingsListQuery = z.infer<typeof adminListingsListQuerySchema>
