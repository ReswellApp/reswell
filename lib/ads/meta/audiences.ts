import "server-only"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import type { ManagedAudience } from "@/lib/types/adsManager"
import { getMetaAdAccountId } from "@/lib/ads/meta/config"
import { metaGet, metaGetAll, metaPost } from "@/lib/ads/meta/http"
import type { ApplyAdsAudienceInput, CreateMetaSavedAudienceInput } from "@/lib/validations/adsManager"

interface MetaAudienceRow {
  id?: string
  name?: string
  approximate_count?: number | string
  approximate_count_lower_bound?: number | string
  subtype?: string
  targeting?: Record<string, unknown>
}

export async function readMetaAudiences(): Promise<ManagedAudience[]> {
  const accountId = requireAccount()
  const [saved, custom] = await Promise.all([
    listAudiences(`act_${accountId}/saved_audiences`, "id,name,approximate_count"),
    listAudiences(`act_${accountId}/customaudiences`, "id,name,approximate_count,subtype"),
  ])
  return [
    ...saved.map((row) => toAudience(row, "saved", "Saved audience")),
    ...custom.map((row) => toAudience(row, "custom", "Custom audience")),
  ].filter((row): row is ManagedAudience => row != null)
}

export async function applyMetaAudience(
  input: Extract<ApplyAdsAudienceInput, { platform: "meta" }>,
): Promise<string> {
  requireAccount()
  if (input.audienceKind === "saved") {
    const saved = await metaGet<MetaAudienceRow>(input.audienceId, { fields: "targeting" })
    if (!saved.targeting) throw new AdsPlatformError("That saved audience has no targeting", "meta")
    await metaPost(input.adSetId, { targeting: saved.targeting })
    return "Applied the saved audience to the ad set."
  }

  const adSet = await metaGet<{ targeting?: Record<string, unknown> }>(input.adSetId, { fields: "targeting" })
  const targeting = adSet.targeting ?? {}
  const existing = Array.isArray(targeting.custom_audiences) ? targeting.custom_audiences : []
  const ids = existing.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const id = (item as { id?: string }).id
    return id ? [id] : []
  })
  if (ids.includes(input.audienceId)) return "That custom audience is already on the ad set."
  await metaPost(input.adSetId, {
    targeting: {
      ...targeting,
      custom_audiences: [...ids.map((id) => ({ id })), { id: input.audienceId }],
    },
  })
  return "Applied the custom audience to the ad set."
}

export async function createMetaSavedAudience(input: CreateMetaSavedAudienceInput): Promise<string> {
  const accountId = requireAccount()
  const created = await metaPost(`act_${accountId}/saved_audiences`, {
    name: input.name,
    targeting: {
      geo_locations: { countries: input.countries },
      age_min: input.ageMin,
      age_max: input.ageMax,
    },
  })
  if (!created.id) throw new AdsPlatformError("Meta did not return a saved audience id", "meta")
  return `Created saved audience ${created.id}.`
}

async function listAudiences(path: string, fields: string): Promise<MetaAudienceRow[]> {
  try {
    const page = await metaGetAll<MetaAudienceRow>(path, { fields, limit: "200" })
    return page.rows
  } catch {
    const fallback = fields.replace(",approximate_count", "").replace(",subtype", "")
    const page = await metaGetAll<MetaAudienceRow>(path, { fields: fallback, limit: "200" })
    return page.rows
  }
}

function toAudience(
  row: MetaAudienceRow,
  kind: "saved" | "custom",
  kindLabel: string,
): ManagedAudience | null {
  const id = row.id?.trim()
  const name = row.name?.trim()
  if (!id || !name) return null
  return {
    platform: "meta",
    id,
    name,
    kind,
    kindLabel,
    size: countOrNull(row.approximate_count ?? row.approximate_count_lower_bound),
  }
}

function requireAccount(): string {
  const accountId = getMetaAdAccountId()
  if (!accountId) throw new AdsPlatformError("Meta Ads is not connected", "meta")
  return accountId
}

function countOrNull(value: number | string | undefined): number | null {
  if (value == null || value === "") return null
  const count = Number(value)
  return Number.isFinite(count) ? count : null
}
