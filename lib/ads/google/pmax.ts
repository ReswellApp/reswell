import "server-only"

import { AdsManagerInputError, AdsPlatformError } from "@/lib/ads/manager/errors"
import { googleAssetOwnedBy, pmaxLinkOwnedBy, pmaxTextLimit } from "@/lib/ads/manager/media"
import { majorToMicros } from "@/lib/ads/manager/money"
import { assertGoogleAdsConfigured } from "@/lib/ads/google/config"
import { mutateGoogleAds, searchGoogleAds } from "@/lib/ads/google/http"
import type { AddPmaxAssetInput, CreateAdsCampaignInput } from "@/lib/validations/adsManager"

type PmaxInput = Extract<CreateAdsCampaignInput, { kind: "google_pmax" }>

export async function createGooglePmaxCampaign(input: PmaxInput): Promise<string> {
  const { customerId } = assertGoogleAdsConfigured()
  assertOwned(customerId, input.marketingImage)
  assertOwned(customerId, input.squareImage)
  assertOwned(customerId, input.logo)

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
        advertisingChannelType: "PERFORMANCE_MAX",
        campaignBudget: budgetResource,
        maximizeConversions: {},
        brandGuidelinesEnabled: false,
        containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
      },
    },
  ])
  const campaignId = campaignResource.split("/").pop() ?? campaignResource

  let assetGroupResource: string
  try {
    assetGroupResource = await mutateGoogleAds(customerId, "assetGroups", [
      {
        create: {
          name: `${input.name} assets`,
          campaign: campaignResource,
          status: "PAUSED",
          finalUrls: [input.finalUrl],
        },
      },
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset group create failed"
    throw new AdsPlatformError(`Created a paused campaign ${campaignId}, but the asset group failed: ${message}`, "google")
  }

  try {
    const links = await pmaxLinks(customerId, input)
    await mutateGoogleAds(
      customerId,
      "assetGroupAssets",
      links.map((link) => ({
        create: {
          assetGroup: assetGroupResource,
          asset: link.asset,
          fieldType: link.fieldType,
        },
      })),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset link failed"
    throw new AdsPlatformError(
      `Created paused campaign ${campaignId}, but Performance Max rejected an asset: ${message}`,
      "google",
    )
  }

  return `Created paused Performance Max campaign ${campaignId}. It will not spend until you enable it.`
}

export async function addPmaxAsset(input: AddPmaxAssetInput): Promise<string> {
  const { customerId } = assertGoogleAdsConfigured()
  if (input.assetKind === "text") {
    const limit = pmaxTextLimit(input.fieldType)
    if (!limit || input.text.length > limit) {
      throw new AdsManagerInputError(`That text is limited to ${limit ?? 0} characters`)
    }
  }
  if (input.assetKind === "image") assertOwned(customerId, input.assetResource)

  const rows = await searchGoogleAds(
    customerId,
    `SELECT asset_group.resource_name FROM asset_group WHERE asset_group.id = ${input.assetGroupId} LIMIT 1`,
  )
  const assetGroup = rows[0]?.assetGroup?.resourceName
  if (!assetGroup) throw new AdsPlatformError("Asset group not found", "google")

  const link = await resolveAddedAsset(customerId, input)
  await mutateGoogleAds(customerId, "assetGroupAssets", [
    {
      create: {
        assetGroup,
        asset: link.asset,
        fieldType: link.fieldType,
      },
    },
  ])
  return "Added the asset to the Performance Max group."
}

export async function removePmaxAsset(linkResource: string): Promise<string> {
  const { customerId } = assertGoogleAdsConfigured()
  if (!pmaxLinkOwnedBy(customerId, linkResource)) {
    throw new AdsPlatformError("That asset is not in this Google Ads account", "google")
  }
  await mutateGoogleAds(customerId, "assetGroupAssets", [{ remove: linkResource }])
  return "Removed the asset from the Performance Max group."
}

async function pmaxLinks(
  customerId: string,
  input: PmaxInput,
): Promise<{ asset: string; fieldType: string }[]> {
  const links: { asset: string; fieldType: string }[] = []
  for (const text of input.headlines) links.push({ asset: await createTextAsset(customerId, text), fieldType: "HEADLINE" })
  for (const text of input.longHeadlines) {
    links.push({ asset: await createTextAsset(customerId, text), fieldType: "LONG_HEADLINE" })
  }
  for (const text of input.descriptions) {
    links.push({ asset: await createTextAsset(customerId, text), fieldType: "DESCRIPTION" })
  }
  links.push({ asset: await createTextAsset(customerId, input.businessName), fieldType: "BUSINESS_NAME" })
  links.push({ asset: input.marketingImage, fieldType: "MARKETING_IMAGE" })
  links.push({ asset: input.squareImage, fieldType: "SQUARE_MARKETING_IMAGE" })
  links.push({ asset: input.logo, fieldType: "LOGO" })
  if (input.youtubeVideoId) {
    links.push({ asset: await createYoutubeAsset(customerId, input.youtubeVideoId), fieldType: "YOUTUBE_VIDEO" })
  }
  return links
}

async function resolveAddedAsset(
  customerId: string,
  input: AddPmaxAssetInput,
): Promise<{ asset: string; fieldType: string }> {
  if (input.assetKind === "text") {
    return { asset: await createTextAsset(customerId, input.text), fieldType: input.fieldType }
  }
  if (input.assetKind === "image") return { asset: input.assetResource, fieldType: input.fieldType }
  return { asset: await createYoutubeAsset(customerId, input.youtubeVideoId), fieldType: "YOUTUBE_VIDEO" }
}

async function createTextAsset(customerId: string, text: string): Promise<string> {
  return mutateGoogleAds(customerId, "assets", [{ create: { textAsset: { text } } }])
}

async function createYoutubeAsset(customerId: string, youtubeVideoId: string): Promise<string> {
  return mutateGoogleAds(customerId, "assets", [{ create: { youtubeVideoAsset: { youtubeVideoId } } }])
}

function assertOwned(customerId: string, resource: string): void {
  if (!googleAssetOwnedBy(customerId, resource)) {
    throw new AdsManagerInputError("Upload the image to this Google Ads account first")
  }
}
