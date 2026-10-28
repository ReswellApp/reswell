import { z } from "zod"
import { BOARD_RADIUS_VALUES } from "@/lib/boards-browse-location"

const radiusSchema = z.enum(BOARD_RADIUS_VALUES)

export const saveProfileBrowseHomeSchema = z
  .object({
    applyOnBoards: z.boolean(),
    localPickupOnly: z.boolean(),
    location: z.string().trim().max(300),
    lat: z.number().gte(-90).lte(90).nullable(),
    lng: z.number().gte(-180).lte(180).nullable(),
    radiusMi: radiusSchema.nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.applyOnBoards) return
    if (!data.location.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a home city or ZIP.",
        path: ["location"],
      })
    }
    if (data.lat == null || data.lng == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick a location from the suggestions or use your current location.",
        path: ["location"],
      })
    }
    if (!data.radiusMi) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a search radius.",
        path: ["radiusMi"],
      })
    }
  })

export type SaveProfileBrowseHomeInput = z.infer<typeof saveProfileBrowseHomeSchema>
