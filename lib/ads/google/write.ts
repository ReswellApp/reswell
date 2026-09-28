import "server-only"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import { majorToMicros } from "@/lib/ads/manager/money"
import { toGoogleStatus } from "@/lib/ads/manager/labels"
import type {
  AddGoogleKeywordInput,
  CreateAdsCampaignInput,
  RemoveAdsEntityInput,
  UpdateAdsEntityInput,
} from "@/lib/validations/adsManager"
import { assertGoogleAdsConfigured } from "@/lib/ads/google/config"
import { mutateGoogleAds, searchGoogleAds, type GoogleAdsRow } from "@/lib/ads/google/http"

export async function createGoogleSearchCampaign(
  input: Extract<CreateAdsCampaignInput, { kind: "google_search" }>,
): Promise<string> {
  const { customerId } = assertGoogleAdsConfigured()
  const budgetResource = await mutateGoogleAds(customerId, "campaignBudgets", [
    {
      create: {
        name: `${input.name} budget`,
        amountMicros: majorToMicros(input.dailyBudget),
        deliveryMethod: "STANDARD",
        explicitlyShared: false,
      },
    },
  ])
  const campaignResource = await mutateGoogleAds(customerId, "campaigns", [
    {
      create: {
        name: input.name,
        status: "PAUSED",
        advertisingChannelType: "SEARCH",
        campaignBudget: budgetResource,
        manualCpc: {},
        containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
        networkSettings: {
          targetGoogleSearch: true,
          targetSearchNetwork: false,
          targetContentNetwork: false,
          targetPartnerSearchNetwork: false,
        },
      },
    },
  ])
  const adGroupResource = await mutateGoogleAds(customerId, "adGroups", [
    {
      create: {
        name: `${input.name} ads`,
        campaign: campaignResource,
        status: "PAUSED",
        type: "SEARCH_STANDARD",
        cpcBidMicros: majorToMicros(input.maxCpc),
      },
    },
  ])

  try {
    await mutateGoogleAds(customerId, "adGroupAds", [
      {
        create: {
          adGroup: adGroupResource,
          status: "PAUSED",
          ad: {
            finalUrls: [input.finalUrl],
            responsiveSearchAd: {
              headlines: input.headlines.map((text) => ({ text })),
              descriptions: input.descriptions.map((text) => ({ text })),
            },
          },
        },
      },
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ad create failed"
    throw new AdsPlatformError(
      `Created a paused campaign but the ad was rejected: ${message}`,
      "google",
    )
  }

  const keywordFailures: string[] = []
  for (const text of input.keywords) {
    try {
      await mutateGoogleAds(customerId, "adGroupCriteria", [
        {
          create: {
            adGroup: adGroupResource,
            status: "ENABLED",
            keyword: { text, matchType: "PHRASE" },
          },
        },
      ])
    } catch (error) {
      keywordFailures.push(error instanceof Error ? error.message : text)
    }
  }

  const campaignId = campaignResource.split("/").pop() ?? campaignResource
  if (keywordFailures.length > 0) {
    return `Created paused campaign ${campaignId}. ${keywordFailures.length} keyword${keywordFailures.length === 1 ? "" : "s"} were rejected.`
  }
  return `Created paused Search campaign ${campaignId}. It will not spend until you enable it.`
}

export async function addGoogleKeyword(input: AddGoogleKeywordInput): Promise<string> {
  const { customerId } = assertGoogleAdsConfigured()
  const adGroup = await requireRow(
    customerId,
    `SELECT ad_group.resource_name FROM ad_group WHERE ad_group.id = ${input.adGroupId} LIMIT 1`,
    "Ad group not found",
  )
  const resource = adGroup.adGroup?.resourceName
  if (!resource) throw new AdsPlatformError("Ad group not found", "google")
  await mutateGoogleAds(customerId, "adGroupCriteria", [
    {
      create: {
        adGroup: resource,
        status: "ENABLED",
        keyword: { text: input.text, matchType: input.matchType },
      },
    },
  ])
  return `Added keyword “${input.text}”.`
}

export async function updateGoogleEntity(input: UpdateAdsEntityInput): Promise<string> {
  if (input.platform !== "google") throw new AdsPlatformError("Not a Google Ads entity", "google")
  const { customerId } = assertGoogleAdsConfigured()

  if (input.primaryText || input.headline || input.description != null) {
    throw new AdsPlatformError("That copy is edited on the Meta ad", "google")
  }

  if (input.status) {
    await mutateStatus(customerId, input, toGoogleStatus(input.status))
  }
  if (input.name) {
    await mutateName(customerId, input, input.name)
  }
  let sharedBudget = false
  if (input.dailyBudget != null) {
    if (input.entity !== "campaign") {
      throw new AdsPlatformError("Google Ads budgets live on the campaign", "google")
    }
    const campaign = await requireRow(
      customerId,
      `SELECT campaign_budget.resource_name, campaign_budget.explicitly_shared
       FROM campaign WHERE campaign.id = ${input.id} LIMIT 1`,
      "Campaign not found",
    )
    const budget = campaign.campaignBudget?.resourceName
    if (!budget) throw new AdsPlatformError("Campaign budget not found", "google")
    sharedBudget = campaign.campaignBudget?.explicitlyShared === true
    await mutateGoogleAds(customerId, "campaignBudgets", [
      {
        update: { resourceName: budget, amountMicros: majorToMicros(input.dailyBudget) },
        updateMask: "amountMicros",
      },
    ])
  }
  if (input.headlines || input.descriptions || input.finalUrl) {
    await updateResponsiveSearchAd(customerId, input)
  }
  if (sharedBudget) {
    return "Saved the Google Ads change. This budget is shared, so every campaign on it uses the new amount."
  }
  return "Saved the Google Ads change."
}

export async function removeGoogleEntity(input: RemoveAdsEntityInput): Promise<string> {
  if (input.platform !== "google") throw new AdsPlatformError("Not a Google Ads entity", "google")
  const { customerId } = assertGoogleAdsConfigured()
  await mutateStatus(customerId, input, "REMOVED")
  return "Removed it from Google Ads."
}

async function updateResponsiveSearchAd(customerId: string, input: UpdateAdsEntityInput): Promise<void> {
  if (input.entity !== "ad") {
    throw new AdsPlatformError("Headlines and descriptions are edited on the ad", "google")
  }
  const row = await requireRow(
    customerId,
    `SELECT ad_group_ad.ad.resource_name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions
     FROM ad_group_ad WHERE ad_group_ad.ad.id = ${input.id} LIMIT 1`,
    "Ad not found",
  )
  const ad = row.adGroupAd?.ad
  if (ad?.type !== "RESPONSIVE_SEARCH_AD" || !ad.resourceName) {
    throw new AdsPlatformError("Only responsive search ads can be edited here", "google")
  }
  const headlines = input.headlines ?? texts(ad.responsiveSearchAd?.headlines)
  const descriptions = input.descriptions ?? texts(ad.responsiveSearchAd?.descriptions)
  const finalUrls = input.finalUrl ? [input.finalUrl] : ad.finalUrls ?? []
  if (headlines.length < 3 || descriptions.length < 2 || finalUrls.length === 0) {
    throw new AdsPlatformError("A responsive search ad needs 3 headlines, 2 descriptions, and a final URL", "google")
  }
  await mutateGoogleAds(customerId, "ads", [
    {
      update: {
        resourceName: ad.resourceName,
        finalUrls,
        responsiveSearchAd: {
          headlines: headlines.map((text) => ({ text })),
          descriptions: descriptions.map((text) => ({ text })),
        },
      },
      updateMask: "finalUrls,responsiveSearchAd.headlines,responsiveSearchAd.descriptions",
    },
  ])
}

async function mutateStatus(
  customerId: string,
  input: { entity: UpdateAdsEntityInput["entity"]; id: string; parentId?: string; kind?: UpdateAdsEntityInput["kind"] },
  status: "ENABLED" | "PAUSED" | "REMOVED",
): Promise<void> {
  const target = await resolveResource(customerId, input)
  await mutateGoogleAds(customerId, target.collection, [
    {
      update: { resourceName: target.resourceName, status },
      updateMask: "status",
    },
  ])
}

async function mutateName(customerId: string, input: UpdateAdsEntityInput, name: string): Promise<void> {
  if (input.entity === "ad" || input.entity === "keyword") {
    throw new AdsPlatformError("Rename the campaign or ad group. Ad and keyword text is edited separately.", "google")
  }
  const target = await resolveResource(customerId, input)
  await mutateGoogleAds(customerId, target.collection, [
    {
      update: { resourceName: target.resourceName, name },
      updateMask: "name",
    },
  ])
}

async function resolveResource(
  customerId: string,
  input: { entity: UpdateAdsEntityInput["entity"]; id: string; parentId?: string; kind?: UpdateAdsEntityInput["kind"] },
): Promise<{ collection: string; resourceName: string }> {
  if (input.entity === "campaign") {
    const row = await requireRow(
      customerId,
      `SELECT campaign.resource_name FROM campaign WHERE campaign.id = ${input.id} LIMIT 1`,
      "Campaign not found",
    )
    const resourceName = row.campaign?.resourceName
    if (!resourceName) throw new AdsPlatformError("Campaign not found", "google")
    return { collection: "campaigns", resourceName }
  }
  if (input.entity === "ad_group") {
    if (input.kind === "asset_group") {
      const row = await requireRow(
        customerId,
        `SELECT asset_group.resource_name FROM asset_group WHERE asset_group.id = ${input.id} LIMIT 1`,
        "Asset group not found",
      )
      const resourceName = row.assetGroup?.resourceName
      if (!resourceName) throw new AdsPlatformError("Asset group not found", "google")
      return { collection: "assetGroups", resourceName }
    }
    const row = await requireRow(
      customerId,
      `SELECT ad_group.resource_name FROM ad_group WHERE ad_group.id = ${input.id} LIMIT 1`,
      "Ad group not found",
    )
    const resourceName = row.adGroup?.resourceName
    if (!resourceName) throw new AdsPlatformError("Ad group not found", "google")
    return { collection: "adGroups", resourceName }
  }
  if (input.entity === "ad") {
    const row = await requireRow(
      customerId,
      `SELECT ad_group_ad.resource_name FROM ad_group_ad WHERE ad_group_ad.ad.id = ${input.id} LIMIT 1`,
      "Ad not found",
    )
    const resourceName = row.adGroupAd?.resourceName
    if (!resourceName) throw new AdsPlatformError("Ad not found", "google")
    return { collection: "adGroupAds", resourceName }
  }
  if (!input.parentId) throw new AdsPlatformError("Keyword updates need an ad group id", "google")
  const row = await requireRow(
    customerId,
    `SELECT ad_group_criterion.resource_name
     FROM ad_group_criterion
     WHERE ad_group_criterion.criterion_id = ${input.id} AND ad_group.id = ${input.parentId}
     LIMIT 1`,
    "Keyword not found",
  )
  const resourceName = row.adGroupCriterion?.resourceName
  if (!resourceName) throw new AdsPlatformError("Keyword not found", "google")
  return { collection: "adGroupCriteria", resourceName }
}

async function requireRow(customerId: string, query: string, message: string): Promise<GoogleAdsRow> {
  const rows = await searchGoogleAds(customerId, query)
  const row = rows[0]
  if (!row) throw new AdsPlatformError(message, "google")
  return row
}

function texts(items: { text?: string }[] | undefined): string[] {
  return (items ?? []).map((item) => item.text?.trim() || "").filter(Boolean)
}
