import { z } from "zod"

import { ADS_RANGE_DAYS } from "@/lib/types/adsManager"

const entityId = z.string().regex(/^\d{1,30}$/, "Invalid id")

const httpsUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => value.startsWith("https://"), "Use an https URL")

const dailyBudget = z.number().positive().max(50_000)

export const adsManagerQuerySchema = z.object({
  days: z.coerce.number().refine((value): value is (typeof ADS_RANGE_DAYS)[number] =>
    (ADS_RANGE_DAYS as readonly number[]).includes(value),
  ),
})

export const createGoogleSearchCampaignSchema = z.object({
  platform: z.literal("google"),
  name: z.string().trim().min(1).max(120),
  dailyBudget,
  finalUrl: httpsUrl,
  headlines: z.array(z.string().trim().min(1).max(30)).min(3).max(15),
  descriptions: z.array(z.string().trim().min(1).max(90)).min(2).max(4),
  keywords: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  maxCpc: z.number().positive().max(100).default(1),
})

export const createMetaCampaignSchema = z.object({
  platform: z.literal("meta"),
  name: z.string().trim().min(1).max(120),
  objective: z.enum(["traffic", "sales"]),
  dailyBudget,
  finalUrl: httpsUrl,
  primaryText: z.string().trim().min(1).max(500),
  headline: z.string().trim().min(1).max(40),
  description: z.string().trim().max(30).default(""),
  imageUrl: httpsUrl,
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(25).default(["US"]),
})

export const createAdsCampaignSchema = z.discriminatedUnion("platform", [
  createGoogleSearchCampaignSchema,
  createMetaCampaignSchema,
])

export const updateAdsEntitySchema = z
  .object({
    platform: z.enum(["google", "meta"]),
    entity: z.enum(["campaign", "ad_group", "ad", "keyword"]),
    id: entityId,
    parentId: entityId.optional(),
    kind: z.enum(["ad_group", "ad_set", "asset_group"]).optional(),
    status: z.enum(["enabled", "paused"]).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    dailyBudget: dailyBudget.optional(),
    finalUrl: httpsUrl.optional(),
    headlines: z.array(z.string().trim().min(1).max(30)).min(3).max(15).optional(),
    descriptions: z.array(z.string().trim().min(1).max(90)).min(2).max(4).optional(),
    primaryText: z.string().trim().min(1).max(500).optional(),
    headline: z.string().trim().min(1).max(40).optional(),
    description: z.string().trim().max(30).optional(),
  })
  .superRefine((value, ctx) => {
    const hasChange =
      value.status != null ||
      value.name != null ||
      value.dailyBudget != null ||
      value.finalUrl != null ||
      value.headlines != null ||
      value.descriptions != null ||
      value.primaryText != null ||
      value.headline != null ||
      value.description != null
    if (!hasChange) {
      ctx.addIssue({ code: "custom", message: "Nothing to update" })
    }
    if (value.entity === "keyword" && !value.parentId) {
      ctx.addIssue({ code: "custom", message: "Keyword updates need an ad group id" })
    }
    if (value.platform === "meta" && value.entity === "keyword") {
      ctx.addIssue({ code: "custom", message: "Meta ads do not use search keywords" })
    }
  })

export const removeAdsEntitySchema = z
  .object({
    platform: z.enum(["google", "meta"]),
    entity: z.enum(["campaign", "ad_group", "ad", "keyword"]),
    id: entityId,
    parentId: entityId.optional(),
    kind: z.enum(["ad_group", "ad_set", "asset_group"]).optional(),
    confirm: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (value.entity === "keyword" && !value.parentId) {
      ctx.addIssue({ code: "custom", message: "Keyword removal needs an ad group id" })
    }
  })

export const addGoogleKeywordSchema = z.object({
  adGroupId: entityId,
  text: z.string().trim().min(1).max(80),
  matchType: z.enum(["EXACT", "PHRASE", "BROAD"]),
})

export type CreateAdsCampaignInput = z.infer<typeof createAdsCampaignSchema>
export type UpdateAdsEntityInput = z.infer<typeof updateAdsEntitySchema>
export type RemoveAdsEntityInput = z.infer<typeof removeAdsEntitySchema>
export type AddGoogleKeywordInput = z.infer<typeof addGoogleKeywordSchema>
