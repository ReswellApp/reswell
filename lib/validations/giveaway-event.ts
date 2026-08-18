import { z } from "zod"
import {
  GIVEAWAY_EVENT_KINDS,
  GIVEAWAY_EVENT_SURFACES,
  GIVEAWAY_PRIZE_BRAND_IDS,
} from "@/lib/types/giveaways"

export const giveawayEventBodySchema = z
  .object({
    slug: z.string().trim().min(1).max(120),
    event: z.enum(GIVEAWAY_EVENT_KINDS),
    surface: z.enum(GIVEAWAY_EVENT_SURFACES),
    preferredBrand: z.enum(GIVEAWAY_PRIZE_BRAND_IDS).nullable().optional(),
  })
  .refine(
    (value) => value.event !== "brand_click" || Boolean(value.preferredBrand),
    { message: "Brand is required for brand clicks.", path: ["preferredBrand"] },
  )

export type GiveawayEventBody = z.infer<typeof giveawayEventBodySchema>
