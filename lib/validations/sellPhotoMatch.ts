import { z } from "zod"

export const SELL_PHOTO_MATCH_CATEGORIES = ["surfboards", "fins"] as const

export type SellPhotoMatchCategory = (typeof SELL_PHOTO_MATCH_CATEGORIES)[number]

export const sellPhotoObservationSchema = z.object({
  category: z.enum(["surfboards", "fins", "unknown"]),
  brandText: z.string().trim().min(1).max(80).nullable(),
  modelText: z.string().trim().min(1).max(80).nullable(),
  visibleText: z.array(z.string().trim().min(1).max(80)).max(8),
  lengthText: z.string().trim().min(1).max(40).nullable(),
  widthText: z.string().trim().min(1).max(40).nullable(),
  thicknessText: z.string().trim().min(1).max(40).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string().trim().min(1).max(280),
})

export type SellPhotoObservation = z.infer<typeof sellPhotoObservationSchema>
