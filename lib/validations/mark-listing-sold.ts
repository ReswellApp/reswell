import { z } from "zod"

export const soldOffPlatformChannelSchema = z.enum([
  "fb_marketplace",
  "craigslist",
  "elsewhere",
])

export const markListingSoldBodySchema = z
  .object({
    channel: soldOffPlatformChannelSchema,
    detail: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "elsewhere") {
      const detail = data.detail?.trim() ?? ""
      if (detail.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please describe where you sold this item",
          path: ["detail"],
        })
      }
    }
  })

export type SoldOffPlatformChannel = z.infer<typeof soldOffPlatformChannelSchema>
export type MarkListingSoldBody = z.infer<typeof markListingSoldBodySchema>

export const SOLD_OFF_PLATFORM_CHANNEL_LABELS: Record<SoldOffPlatformChannel, string> = {
  fb_marketplace: "FB Marketplace",
  craigslist: "Craigslist",
  elsewhere: "Elsewhere",
}
