import "server-only"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import type { ManagedAudience } from "@/lib/types/adsManager"
import { assertGoogleAdsConfigured } from "@/lib/ads/google/config"
import { mutateGoogleAds, searchGoogleAds } from "@/lib/ads/google/http"
import type { ApplyAdsAudienceInput } from "@/lib/validations/adsManager"

const ROW_CAP = 400

export async function readGoogleAudiences(): Promise<ManagedAudience[]> {
  const { customerId } = assertGoogleAdsConfigured()
  const [lists, audiences] = await Promise.all([
    searchGoogleAds(
      customerId,
      "SELECT user_list.id, user_list.name, user_list.size_for_display, user_list.membership_status FROM user_list",
    ),
    searchGoogleAds(
      customerId,
      "SELECT audience.id, audience.name, audience.description, audience.status FROM audience WHERE audience.status != 'REMOVED'",
    ),
  ])
  const rows: ManagedAudience[] = []
  for (const row of lists) {
    const id = row.userList?.id
    const name = row.userList?.name?.trim()
    if (!id || !name) continue
    rows.push({
      platform: "google",
      id,
      name,
      kind: "user_list",
      kindLabel: "User list",
      size: countOrNull(row.userList?.sizeForDisplay),
    })
    if (rows.length >= ROW_CAP) return rows
  }
  for (const row of audiences) {
    const id = row.audience?.id
    const name = row.audience?.name?.trim()
    if (!id || !name) continue
    rows.push({
      platform: "google",
      id,
      name,
      kind: "google_audience",
      kindLabel: "Google audience",
      size: null,
    })
    if (rows.length >= ROW_CAP) break
  }
  return rows
}

export async function applyGoogleAudience(
  input: Extract<ApplyAdsAudienceInput, { platform: "google" }>,
): Promise<string> {
  const { customerId } = assertGoogleAdsConfigured()
  const groups = await searchGoogleAds(
    customerId,
    `SELECT ad_group.resource_name FROM ad_group WHERE ad_group.id = ${input.adGroupId} LIMIT 1`,
  )
  const adGroup = groups[0]?.adGroup?.resourceName
  if (!adGroup) throw new AdsPlatformError("Ad group not found", "google")

  if (input.audienceKind === "user_list") {
    await mutateGoogleAds(customerId, "adGroupCriteria", [
      {
        create: {
          adGroup,
          status: "ENABLED",
          userList: { userList: `customers/${customerId}/userLists/${input.audienceId}` },
        },
      },
    ])
    return "Applied the user list to the ad group."
  }

  await mutateGoogleAds(customerId, "adGroupCriteria", [
    {
      create: {
        adGroup,
        status: "ENABLED",
        audience: { audience: `customers/${customerId}/audiences/${input.audienceId}` },
      },
    },
  ])
  return "Applied the Google audience to the ad group."
}

function countOrNull(value: string | undefined): number | null {
  if (!value) return null
  const count = Number(value)
  return Number.isFinite(count) ? count : null
}
