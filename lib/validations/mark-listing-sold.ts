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

/** Stripe USD card minimum is $0.50 — do not inflate percentage presets to a higher floor. */
export const SALE_TIP_MIN_CENTS = 50
export const SALE_TIP_MIN_USD_LABEL = "$0.50"
export const SALE_TIP_MAX_CENTS = 250_000
export const SALE_TIP_MAX_USD_LABEL = "$2,500"
export const SALE_TIP_PRESET_PERCENTS = [3, 5, 7] as const

export type SaleTipPresetPercent = (typeof SALE_TIP_PRESET_PERCENTS)[number]

export function saleTipCentsForListingPercent(
  listingPriceUsd: number,
  percent: SaleTipPresetPercent,
): number {
  if (!Number.isFinite(listingPriceUsd) || listingPriceUsd <= 0) return 0
  const listingCents = Math.round(listingPriceUsd * 100)
  return Math.round((listingCents * percent) / 100)
}

export function clampSaleTipCents(cents: number): number {
  return Math.min(SALE_TIP_MAX_CENTS, Math.max(SALE_TIP_MIN_CENTS, cents))
}

/** Exact percent of listing price, or null when below the chargeable minimum. */
export function saleTipPresetCents(
  listingPriceUsd: number,
  percent: SaleTipPresetPercent,
): number | null {
  const cents = saleTipCentsForListingPercent(listingPriceUsd, percent)
  if (cents < SALE_TIP_MIN_CENTS) return null
  return Math.min(SALE_TIP_MAX_CENTS, cents)
}

export const saleTipBodySchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(SALE_TIP_MIN_CENTS, `Tip must be at least ${SALE_TIP_MIN_USD_LABEL}`)
    .max(SALE_TIP_MAX_CENTS, `Tip cannot be more than ${SALE_TIP_MAX_USD_LABEL}`),
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
