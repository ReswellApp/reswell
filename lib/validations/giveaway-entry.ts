import { z } from "zod"
import { GIVEAWAY_PRIZE_BRAND_IDS } from "@/lib/types/giveaways"

export const giveawayEntryBodySchema = z.object({
  preferredBrand: z.enum(GIVEAWAY_PRIZE_BRAND_IDS).nullable().optional(),
  signedUpFromCta: z.boolean().optional(),
})

export type GiveawayEntryBody = z.infer<typeof giveawayEntryBodySchema>
