import "server-only"

import { mapDeliveryStatus, humanizeEnum } from "@/lib/ads/manager/labels"
import type { CreativeFieldType, ManagedCreativeAsset } from "@/lib/types/adsManager"
import { assertGoogleAdsConfigured } from "@/lib/ads/google/config"
import { searchGoogleAds } from "@/lib/ads/google/http"

const ROW_CAP = 400

export async function readGoogleCreativeAssets(): Promise<ManagedCreativeAsset[]> {
  const { customerId } = assertGoogleAdsConfigured()
  const rows = await searchGoogleAds(
    customerId,
    `SELECT asset_group.id, campaign.id, asset_group_asset.field_type, asset_group_asset.status,
      asset_group_asset.resource_name, asset.id, asset.name, asset.type, asset.text_asset.text,
      asset.image_asset.full_size.url, asset.youtube_video_asset.youtube_video_id
     FROM asset_group_asset
     WHERE asset_group_asset.status != 'REMOVED'`,
  )
  const assets: ManagedCreativeAsset[] = []
  for (const row of rows) {
    const assetGroupId = row.assetGroup?.id
    const linkResource = row.assetGroupAsset?.resourceName
    const assetId = row.asset?.id
    if (!assetGroupId || !linkResource || !assetId) continue
    const fieldType = mapCreativeField(row.assetGroupAsset?.fieldType)
    assets.push({
      platform: "google",
      id: `${assetGroupId}:${assetId}:${row.assetGroupAsset?.fieldType ?? "OTHER"}`,
      assetGroupId,
      campaignId: row.campaign?.id ?? "",
      fieldType,
      fieldLabel: humanizeEnum(row.assetGroupAsset?.fieldType) ?? "Asset",
      text: row.asset?.textAsset?.text?.trim() || row.asset?.name?.trim() || null,
      previewUrl: row.asset?.imageAsset?.fullSize?.url ?? null,
      youtubeId: row.asset?.youtubeVideoAsset?.youtubeVideoId ?? null,
      linkResource,
      status: mapDeliveryStatus(row.assetGroupAsset?.status),
    })
    if (assets.length >= ROW_CAP) break
  }
  return assets
}

function mapCreativeField(raw: string | undefined): CreativeFieldType {
  switch (raw) {
    case "HEADLINE":
      return "headline"
    case "LONG_HEADLINE":
      return "long_headline"
    case "DESCRIPTION":
      return "description"
    case "MARKETING_IMAGE":
      return "marketing_image"
    case "SQUARE_MARKETING_IMAGE":
      return "square_image"
    case "LOGO":
      return "logo"
    case "YOUTUBE_VIDEO":
      return "youtube_video"
    case "BUSINESS_NAME":
      return "business_name"
    default:
      return "other"
  }
}
