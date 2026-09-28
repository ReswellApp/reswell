"use server"

import { revalidatePath } from "next/cache"

import { AdsManagerInputError, AdsPlatformError, publicAdsError } from "@/lib/ads/manager/errors"
import {
  addGoogleKeywordService,
  addPmaxAssetService,
  applyAdsAudienceService,
  createAdsCampaignService,
  createMetaSavedAudienceService,
  removeAdsEntityService,
  removePmaxAssetService,
  updateAdsEntityService,
} from "@/lib/services/adsManager"

const ADS_PATH = "/admin/ads"

export type AdsActionResult = { success: true; message: string } | { error: string }

export async function createAdsCampaignAction(raw: unknown): Promise<AdsActionResult> {
  return runAdsAction("create", () => createAdsCampaignService(raw))
}

export async function updateAdsEntityAction(raw: unknown): Promise<AdsActionResult> {
  return runAdsAction("update", () => updateAdsEntityService(raw))
}

export async function removeAdsEntityAction(raw: unknown): Promise<AdsActionResult> {
  return runAdsAction("remove", () => removeAdsEntityService(raw))
}

export async function addGoogleKeywordAction(raw: unknown): Promise<AdsActionResult> {
  return runAdsAction("add-keyword", () => addGoogleKeywordService(raw))
}

export async function addPmaxAssetAction(raw: unknown): Promise<AdsActionResult> {
  return runAdsAction("add-asset", () => addPmaxAssetService(raw))
}

export async function removePmaxAssetAction(raw: unknown): Promise<AdsActionResult> {
  return runAdsAction("remove-asset", () => removePmaxAssetService(raw))
}

export async function applyAdsAudienceAction(raw: unknown): Promise<AdsActionResult> {
  return runAdsAction("apply-audience", () => applyAdsAudienceService(raw))
}

export async function createMetaSavedAudienceAction(raw: unknown): Promise<AdsActionResult> {
  return runAdsAction("create-audience", () => createMetaSavedAudienceService(raw))
}

async function runAdsAction(op: string, run: () => Promise<string>): Promise<AdsActionResult> {
  try {
    const message = await run()
    revalidatePath(ADS_PATH)
    return { success: true, message }
  } catch (error) {
    if (error instanceof AdsManagerInputError || error instanceof AdsPlatformError) {
      console.error("[ads-manager]", JSON.stringify({ op, at: new Date().toISOString(), message: error.message.slice(0, 500) }))
      return { error: publicAdsError(error) }
    }
    console.error("[ads-manager]", JSON.stringify({ op, at: new Date().toISOString(), message: "unexpected" }))
    return { error: "Could not save that ads change" }
  }
}
