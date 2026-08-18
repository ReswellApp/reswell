import { z } from "zod"

export const soldOffPlatformChannelSchema = z.enum([
  "reswell",
  "fb_marketplace",
  "craigslist",
  "elsewhere",
])

function refineElsewhereDetail(
  data: { channel?: string; detail?: string },
  ctx: z.RefinementCtx,
) {
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
}

export const markListingSoldBodySchema = z
  .object({
    channel: soldOffPlatformChannelSchema.optional(),
    detail: z.string().trim().max(200).optional(),
    reswellHelpedFindBuyer: z.boolean().optional(),
  })
  .superRefine(refineElsewhereDetail)

export const listingSaleFeedbackBodySchema = z
  .object({
    channel: soldOffPlatformChannelSchema.optional(),
    detail: z.string().trim().max(200).optional(),
    reswellHelpedFindBuyer: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === undefined && data.reswellHelpedFindBuyer === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nothing to update",
      })
    }
    refineElsewhereDetail(data, ctx)
  })

export const SALE_TIP_MIN_CENTS = 100
export const SALE_TIP_MAX_CENTS = 50_000
export const SALE_TIP_PRESET_CENTS = [500, 1000, 2000, 5000] as const

export const saleTipBodySchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(SALE_TIP_MIN_CENTS, "Tip must be at least $1")
    .max(SALE_TIP_MAX_CENTS, "Tip cannot be more than $500"),
})

export type SoldOffPlatformChannel = z.infer<typeof soldOffPlatformChannelSchema>
export type MarkListingSoldBody = z.infer<typeof markListingSoldBodySchema>
export type ListingSaleFeedbackBody = z.infer<typeof listingSaleFeedbackBodySchema>
export type SaleTipBody = z.infer<typeof saleTipBodySchema>

export const SOLD_OFF_PLATFORM_CHANNEL_LABELS: Record<SoldOffPlatformChannel, string> = {
  reswell: "A buyer I met on Reswell",
  fb_marketplace: "FB Marketplace",
  craigslist: "Craigslist",
  elsewhere: "Somewhere else",
}
