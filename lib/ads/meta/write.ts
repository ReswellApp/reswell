import "server-only"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import { majorToMetaMinor } from "@/lib/ads/manager/money"
import { toMetaStatus } from "@/lib/ads/manager/labels"
import {
  getMetaAdAccountId,
  getMetaAdsPageId,
  metaAdsCreateMissingConfig,
} from "@/lib/ads/meta/config"
import { metaDelete, metaGet, metaPost, metaPostForm } from "@/lib/ads/meta/http"
import type { CreateAdsCampaignInput, RemoveAdsEntityInput, UpdateAdsEntityInput } from "@/lib/validations/adsManager"

interface MetaCreativeSpec {
  object_story_spec?: {
    page_id?: string
    link_data?: {
      link?: string
      message?: string
      name?: string
      description?: string
      image_hash?: string
      call_to_action?: { type?: string; value?: { link?: string } }
    }
  }
}

export async function createMetaLinkCampaign(
  input: Extract<CreateAdsCampaignInput, { platform: "meta" }>,
): Promise<string> {
  const missing = metaAdsCreateMissingConfig()
  if (missing.length > 0) {
    throw new AdsPlatformError(`Meta ad creation needs ${missing.join(", ")}`, "meta")
  }
  const accountId = getMetaAdAccountId()
  const pageId = getMetaAdsPageId()
  if (!accountId || !pageId) throw new AdsPlatformError("Meta Ads is not connected", "meta")

  const currency = await accountCurrency(accountId)
  const objective = input.objective === "sales" ? "OUTCOME_SALES" : "OUTCOME_TRAFFIC"
  const campaign = await metaPost(`act_${accountId}/campaigns`, {
    name: input.name,
    objective,
    status: "PAUSED",
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  })
  if (!campaign.id) throw new AdsPlatformError("Meta did not return a campaign id", "meta")

  const adSetBody: Record<string, unknown> = {
    name: `${input.name} ads`,
    campaign_id: campaign.id,
    daily_budget: majorToMetaMinor(input.dailyBudget, currency),
    billing_event: "IMPRESSIONS",
    optimization_goal: input.objective === "sales" ? "OFFSITE_CONVERSIONS" : "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: {
      geo_locations: { countries: input.countries },
      targeting_automation: { advantage_audience: 0 },
    },
    status: "PAUSED",
  }
  if (input.objective === "sales") {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
    if (!pixelId) {
      throw new AdsPlatformError(
        `Created paused campaign ${campaign.id}, but sales ads need NEXT_PUBLIC_META_PIXEL_ID`,
        "meta",
      )
    }
    adSetBody.promoted_object = { pixel_id: pixelId, custom_event_type: "PURCHASE" }
  }

  let adSetId: string
  try {
    const adSet = await metaPost(`act_${accountId}/adsets`, adSetBody)
    if (!adSet.id) throw new AdsPlatformError("Meta did not return an ad set id", "meta")
    adSetId = adSet.id
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ad set create failed"
    throw new AdsPlatformError(`Created paused campaign ${campaign.id}, but the ad set failed: ${message}`, "meta")
  }

  try {
    const hash = await uploadImage(accountId, input.imageUrl)
    const creative = await metaPost(`act_${accountId}/adcreatives`, {
      name: `${input.name} creative`,
      object_story_spec: linkStory({
        pageId,
        link: input.finalUrl,
        message: input.primaryText,
        name: input.headline,
        description: input.description,
        imageHash: hash,
      }),
    })
    if (!creative.id) throw new AdsPlatformError("Meta did not return a creative id", "meta")
    await metaPost(`act_${accountId}/ads`, {
      name: input.name,
      adset_id: adSetId,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ad create failed"
    throw new AdsPlatformError(
      `Created paused campaign ${campaign.id}, but the ad was rejected: ${message}`,
      "meta",
    )
  }

  return `Created paused Meta campaign ${campaign.id}. It will not spend until you enable it.`
}

export async function updateMetaEntity(input: UpdateAdsEntityInput): Promise<string> {
  if (input.platform !== "meta") throw new AdsPlatformError("Not a Meta Ads entity", "meta")
  if (input.entity === "keyword") throw new AdsPlatformError("Meta ads do not use search keywords", "meta")
  const accountId = getMetaAdAccountId()
  if (!accountId) throw new AdsPlatformError("Meta Ads is not connected", "meta")

  if (input.headlines || input.descriptions) {
    throw new AdsPlatformError("Meta copy uses primary text, headline, and description", "meta")
  }

  const body: Record<string, unknown> = {}
  if (input.status) body.status = toMetaStatus(input.status)
  if (input.name && input.entity !== "ad") body.name = input.name
  if (input.name && input.entity === "ad") body.name = input.name
  if (input.dailyBudget != null) {
    if (input.entity === "ad") throw new AdsPlatformError("Meta budgets live on the campaign or ad set", "meta")
    const currency = await accountCurrency(accountId)
    body.daily_budget = majorToMetaMinor(input.dailyBudget, currency)
  }
  if (Object.keys(body).length > 0) {
    await metaPost(input.id, body)
  }
  if (input.entity === "ad" && (input.primaryText || input.headline || input.description != null || input.finalUrl)) {
    await replaceAdCreative(accountId, input)
  }
  return "Saved the Meta Ads change."
}

export async function removeMetaEntity(input: RemoveAdsEntityInput): Promise<string> {
  if (input.platform !== "meta") throw new AdsPlatformError("Not a Meta Ads entity", "meta")
  if (input.entity === "keyword") throw new AdsPlatformError("Meta ads do not use search keywords", "meta")
  await metaDelete(input.id)
  return "Removed it from Meta Ads."
}

async function replaceAdCreative(accountId: string, input: UpdateAdsEntityInput): Promise<void> {
  const current = await metaGet<{ creative?: MetaCreativeSpec & { id?: string } }>(input.id, {
    fields: "creative{object_story_spec}",
  })
  const story = current.creative?.object_story_spec
  const link = story?.link_data
  const pageId = story?.page_id || getMetaAdsPageId()
  if (!pageId || !link?.image_hash) {
    throw new AdsPlatformError("This ad has no link creative to edit. Create a new ad instead.", "meta")
  }
  const nextLink = input.finalUrl ?? link.link
  const message = input.primaryText ?? link.message
  const name = input.headline ?? link.name
  if (!nextLink || !message || !name) {
    throw new AdsPlatformError("A Meta link ad needs a URL, primary text, and headline", "meta")
  }
  const creative = await metaPost(`act_${accountId}/adcreatives`, {
    name: `Updated ${input.id}`,
    object_story_spec: linkStory({
      pageId,
      link: nextLink,
      message,
      name,
      description: input.description ?? link.description ?? "",
      imageHash: link.image_hash,
    }),
  })
  if (!creative.id) throw new AdsPlatformError("Meta did not return a creative id", "meta")
  await metaPost(input.id, { creative: { creative_id: creative.id } })
}

async function uploadImage(accountId: string, imageUrl: string): Promise<string> {
  const uploaded = await metaPostForm(`act_${accountId}/adimages`, { url: imageUrl })
  const images = (uploaded as { images?: Record<string, { hash?: string }> }).images
  const hash = images ? Object.values(images).find((image) => image.hash)?.hash : undefined
  if (!hash) throw new AdsPlatformError("Meta did not accept the image URL", "meta")
  return hash
}

async function accountCurrency(accountId: string): Promise<string> {
  const account = await metaGet<{ currency?: string }>(`act_${accountId}`, { fields: "currency" })
  return account.currency?.trim() || "USD"
}

function linkStory(input: {
  pageId: string
  link: string
  message: string
  name: string
  description: string
  imageHash: string
}): MetaCreativeSpec["object_story_spec"] {
  return {
    page_id: input.pageId,
    link_data: {
      link: input.link,
      message: input.message,
      name: input.name,
      description: input.description || undefined,
      image_hash: input.imageHash,
      call_to_action: { type: "SHOP_NOW", value: { link: input.link } },
    },
  }
}
