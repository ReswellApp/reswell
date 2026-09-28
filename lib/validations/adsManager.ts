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

const assetResource = z.string().regex(/^customers\/\d+\/assets\/\d+$/, "Upload the image first")

export const createGoogleSearchCampaignSchema = z.object({
  kind: z.literal("google_search"),
  name: z.string().trim().min(1).max(120),
  dailyBudget,
  finalUrl: httpsUrl,
  headlines: z.array(z.string().trim().min(1).max(30)).min(3).max(15),
  descriptions: z.array(z.string().trim().min(1).max(90)).min(2).max(4),
  keywords: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  maxCpc: z.number().positive().max(100).default(1),
})

export const createGooglePmaxCampaignSchema = z.object({
  kind: z.literal("google_pmax"),
  name: z.string().trim().min(1).max(120),
  dailyBudget,
  finalUrl: httpsUrl,
  headlines: z.array(z.string().trim().min(1).max(30)).min(3).max(15),
  longHeadlines: z.array(z.string().trim().min(1).max(90)).min(1).max(5),
  descriptions: z.array(z.string().trim().min(1).max(90)).min(2).max(5),
  businessName: z.string().trim().min(1).max(25),
  marketingImage: assetResource,
  squareImage: assetResource,
  logo: assetResource,
  youtubeVideoId: z.string().regex(/^[\w-]{11}$/, "Use a YouTube link or 11-character id").optional(),
})

export const createMetaCampaignSchema = z.object({
  kind: z.literal("meta_link"),
  name: z.string().trim().min(1).max(120),
  objective: z.enum(["traffic", "sales"]),
  dailyBudget,
  finalUrl: httpsUrl,
  primaryText: z.string().trim().min(1).max(500),
  headline: z.string().trim().min(1).max(40),
  description: z.string().trim().max(30).default(""),
  imageUrl: httpsUrl.optional(),
  imageHash: z.string().trim().regex(/^[A-Za-z0-9]{8,64}$/, "Upload the image again").optional(),
  videoId: z.string().trim().regex(/^\d{5,30}$/, "Upload the video again").optional(),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(25).default(["US"]),
})

export const createAdsCampaignSchema = z
  .discriminatedUnion("kind", [
    createGoogleSearchCampaignSchema,
    createGooglePmaxCampaignSchema,
    createMetaCampaignSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.kind === "meta_link" && !value.imageUrl && !value.imageHash) {
      ctx.addIssue({ code: "custom", message: "Add an image URL or upload an image", path: ["imageUrl"] })
    }
  })

export const adsMediaRoleSchema = z.enum([
  "marketing_image",
  "square_image",
  "logo",
  "meta_image",
  "meta_video",
])

export const addPmaxAssetSchema = z.discriminatedUnion("assetKind", [
  z.object({
    assetKind: z.literal("text"),
    assetGroupId: entityId,
    fieldType: z.enum(["HEADLINE", "LONG_HEADLINE", "DESCRIPTION", "BUSINESS_NAME"]),
    text: z.string().trim().min(1).max(90),
  }),
  z.object({
    assetKind: z.literal("image"),
    assetGroupId: entityId,
    fieldType: z.enum(["MARKETING_IMAGE", "SQUARE_MARKETING_IMAGE", "LOGO"]),
    assetResource,
  }),
  z.object({
    assetKind: z.literal("youtube"),
    assetGroupId: entityId,
    youtubeVideoId: z.string().regex(/^[\w-]{11}$/, "Use a YouTube link or 11-character id"),
  }),
])

export const removePmaxAssetSchema = z.object({
  linkResource: z.string().regex(/^customers\/\d+\/assetGroupAssets\/\d+~\d+~[A-Z0-9_]+$/),
  confirm: z.literal(true),
})

export const applyAdsAudienceSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("google"),
    audienceId: entityId,
    audienceKind: z.enum(["user_list", "google_audience"]),
    adGroupId: entityId,
  }),
  z.object({
    platform: z.literal("meta"),
    audienceId: entityId,
    audienceKind: z.enum(["saved", "custom"]),
    adSetId: entityId,
  }),
])

export const createMetaSavedAudienceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(25),
    ageMin: z.number().int().min(13).max(65),
    ageMax: z.number().int().min(13).max(65),
  })
  .refine((value) => value.ageMax >= value.ageMin, { message: "Maximum age must be at least the minimum age" })

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
export type AdsMediaRole = z.infer<typeof adsMediaRoleSchema>
export type AddPmaxAssetInput = z.infer<typeof addPmaxAssetSchema>
export type RemovePmaxAssetInput = z.infer<typeof removePmaxAssetSchema>
export type ApplyAdsAudienceInput = z.infer<typeof applyAdsAudienceSchema>
export type CreateMetaSavedAudienceInput = z.infer<typeof createMetaSavedAudienceSchema>
