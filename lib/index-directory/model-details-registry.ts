import type { BoardModelDetail, BrandProfile, BoardModel } from "@/lib/index-directory/types"
import { getAllBrandSlugs, getBrandProfileBySlug } from "@/lib/index-directory/registry"
import albumSurfModelDetailsBySlug from "@/lib/index-directory/data/album-surf-model-details.json"
import bingSurfboardsModelDetailsBySlug from "@/lib/index-directory/data/bing-surfboards-model-details.json"
import theSolutionDetail from "@/lib/index-directory/data/model-details/channel-islands-surfboards-the-solution.json"
import chilliSurfboardsModelDetailsBySlug from "@/lib/index-directory/data/chilli-surfboards-model-details.json"
import lovelaceTwrpDetail from "@/lib/index-directory/data/model-details/lovelace-machine-twrp.json"
import lovelaceTheMachineDetail from "@/lib/index-directory/data/model-details/lovelace-machine-the-machine.json"
import lovelaceBigpinDetail from "@/lib/index-directory/data/model-details/lovelace-machine-bigpin.json"
import lovelaceGordoFeoDetail from "@/lib/index-directory/data/model-details/lovelace-machine-gordo-feo.json"
import lovelaceBurnerDetail from "@/lib/index-directory/data/model-details/lovelace-machine-burner.json"
import lovelaceEveningstarDetail from "@/lib/index-directory/data/model-details/lovelace-machine-eveningstar.json"
import { sharpeyeSurfboardsModelDetailsBySlug } from "@/lib/index-directory/sharpeye-model-details.generated"
import lostSurfboardsModelDetailsBySlug from "@/lib/index-directory/data/lost-surfboards-model-details.json"
import pyzelSurfboardsModelDetailsBySlug from "@/lib/index-directory/data/pyzel-surfboards-model-details.json"
import robertsSurfboardsModelDetailsBySlug from "@/lib/index-directory/data/roberts-surfboards-model-details.json"
import haydenShapesModelDetailsBySlug from "@/lib/index-directory/data/hayden-shapes-model-details.json"
import jsSurfboardsModelDetailsBySlug from "@/lib/index-directory/data/js-surfboards-model-details.json"
import dhdSurfboardsModelDetailsBySlug from "@/lib/index-directory/data/dhd-surfboards-model-details.json"

const DETAILS: Record<string, Record<string, BoardModelDetail>> = {
  "album-surf": albumSurfModelDetailsBySlug as Record<string, BoardModelDetail>,
  "bing-surfboards": bingSurfboardsModelDetailsBySlug as Record<string, BoardModelDetail>,
  "channel-islands-surfboards": {
    "the-solution": theSolutionDetail as BoardModelDetail,
  },
  "chilli-surfboards": chilliSurfboardsModelDetailsBySlug as Record<string, BoardModelDetail>,
  "lovelace-machine": {
    twrp: lovelaceTwrpDetail as BoardModelDetail,
    "the-machine": lovelaceTheMachineDetail as BoardModelDetail,
    bigpin: lovelaceBigpinDetail as BoardModelDetail,
    "gordo-feo": lovelaceGordoFeoDetail as BoardModelDetail,
    burner: lovelaceBurnerDetail as BoardModelDetail,
    eveningstar: lovelaceEveningstarDetail as BoardModelDetail,
  },
  "sharpeye-surfboards": sharpeyeSurfboardsModelDetailsBySlug,
  "lost-surfboards": lostSurfboardsModelDetailsBySlug as Record<string, BoardModelDetail>,
  "pyzel-surfboards": pyzelSurfboardsModelDetailsBySlug as Record<string, BoardModelDetail>,
  "roberts-surfboards": robertsSurfboardsModelDetailsBySlug as Record<string, BoardModelDetail>,
  "hayden-shapes": haydenShapesModelDetailsBySlug as Record<string, BoardModelDetail>,
  "js-surfboards": jsSurfboardsModelDetailsBySlug as Record<string, BoardModelDetail>,
  "dhd-surfboards": dhdSurfboardsModelDetailsBySlug as Record<string, BoardModelDetail>,
}

export function getModelDetail(brandSlug: string, modelSlug: string): BoardModelDetail | null {
  return DETAILS[brandSlug]?.[modelSlug] ?? null
}

export type BrandModelPagePayload = {
  brand: BrandProfile
  model: BoardModel
  detail: BoardModelDetail | null
}

export function getBrandModelPagePayload(
  brandSlug: string,
  modelSlug: string,
): BrandModelPagePayload | null {
  const brand = getBrandProfileBySlug(brandSlug)
  if (!brand) return null
  const model = brand.models.find((m) => m.slug === modelSlug)
  if (!model) return null
  return {
    brand,
    model,
    detail: getModelDetail(brandSlug, modelSlug),
  }
}

export function getAllBrandModelStaticParams(): { slug: string; modelSlug: string }[] {
  const out: { slug: string; modelSlug: string }[] = []
  for (const slug of getAllBrandSlugs()) {
    const b = getBrandProfileBySlug(slug)
    if (!b) continue
    for (const m of b.models) {
      out.push({ slug, modelSlug: m.slug })
    }
  }
  return out
}
