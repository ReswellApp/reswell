import type { BrandProfile, DirectoryListEntry } from "@/lib/index-directory/types"
import albumSurfData from "@/lib/index-directory/data/album-surf.json"
import bingSurfboardsData from "@/lib/index-directory/data/bing-surfboards.json"
import channelIslandsData from "@/lib/index-directory/data/channel-islands.json"
import chilliSurfboardsData from "@/lib/index-directory/data/chilli-surfboards.json"
import lovelaceMachineData from "@/lib/index-directory/data/lovelace-machine.json"
import sharpeyeSurfboardsData from "@/lib/index-directory/data/sharpeye-surfboards.json"
import lostSurfboardsData from "@/lib/index-directory/data/lost-surfboards.json"
import pyzelSurfboardsData from "@/lib/index-directory/data/pyzel-surfboards.json"
import robertsSurfboardsData from "@/lib/index-directory/data/roberts-surfboards.json"
import haydenShapesData from "@/lib/index-directory/data/hayden-shapes.json"
import jsSurfboardsData from "@/lib/index-directory/data/js-surfboards.json"
import dhdSurfboardsData from "@/lib/index-directory/data/dhd-surfboards.json"

const albumSurf = albumSurfData as BrandProfile
const bingSurfboards = bingSurfboardsData as BrandProfile
const channelIslands = channelIslandsData as BrandProfile
const chilliSurfboards = chilliSurfboardsData as BrandProfile
const lovelaceMachine = lovelaceMachineData as BrandProfile
const sharpeyeSurfboards = sharpeyeSurfboardsData as BrandProfile
const lostSurfboards = lostSurfboardsData as BrandProfile
const pyzelSurfboards = pyzelSurfboardsData as BrandProfile
const robertsSurfboards = robertsSurfboardsData as BrandProfile
const haydenShapes = haydenShapesData as BrandProfile
const jsSurfboards = jsSurfboardsData as BrandProfile
const dhdSurfboards = dhdSurfboardsData as BrandProfile

const BRAND_BY_SLUG: Record<string, BrandProfile> = {
  [albumSurf.slug]: albumSurf,
  [bingSurfboards.slug]: bingSurfboards,
  [channelIslands.slug]: channelIslands,
  [chilliSurfboards.slug]: chilliSurfboards,
  [lovelaceMachine.slug]: lovelaceMachine,
  [sharpeyeSurfboards.slug]: sharpeyeSurfboards,
  [lostSurfboards.slug]: lostSurfboards,
  [pyzelSurfboards.slug]: pyzelSurfboards,
  [robertsSurfboards.slug]: robertsSurfboards,
  [haydenShapes.slug]: haydenShapes,
  [jsSurfboards.slug]: jsSurfboards,
  [dhdSurfboards.slug]: dhdSurfboards,
}

export function getBrandProfileBySlug(slug: string): BrandProfile | undefined {
  return BRAND_BY_SLUG[slug]
}

export function getAllBrandSlugs(): string[] {
  return Object.keys(BRAND_BY_SLUG)
}

/** Cards shown on the Index directory — extend as you add profiles. */
export function getDirectoryListEntries(): DirectoryListEntry[] {
  return [
    {
      slug: albumSurf.slug,
      kind: "brand",
      name: albumSurf.name,
      shortDescription: albumSurf.shortDescription,
      logoUrl: albumSurf.logoUrl,
      locationLabel: albumSurf.locationLabel,
      modelCount: albumSurf.models.length,
    },
    {
      slug: bingSurfboards.slug,
      kind: "brand",
      name: bingSurfboards.name,
      shortDescription: bingSurfboards.shortDescription,
      logoUrl: bingSurfboards.logoUrl,
      locationLabel: bingSurfboards.locationLabel,
      modelCount: bingSurfboards.models.length,
    },
    {
      slug: channelIslands.slug,
      kind: "brand",
      name: channelIslands.name,
      shortDescription: channelIslands.shortDescription,
      logoUrl: channelIslands.logoUrl,
      locationLabel: channelIslands.locationLabel,
      modelCount: channelIslands.models.length,
    },
    {
      slug: chilliSurfboards.slug,
      kind: "brand",
      name: chilliSurfboards.name,
      shortDescription: chilliSurfboards.shortDescription,
      logoUrl: chilliSurfboards.logoUrl,
      locationLabel: chilliSurfboards.locationLabel,
      modelCount: chilliSurfboards.models.length,
    },
    {
      slug: lovelaceMachine.slug,
      kind: "brand",
      name: lovelaceMachine.name,
      shortDescription: lovelaceMachine.shortDescription,
      logoUrl: lovelaceMachine.logoUrl,
      locationLabel: lovelaceMachine.locationLabel,
      modelCount: lovelaceMachine.models.length,
    },
    {
      slug: sharpeyeSurfboards.slug,
      kind: "brand",
      name: sharpeyeSurfboards.name,
      shortDescription: sharpeyeSurfboards.shortDescription,
      logoUrl: sharpeyeSurfboards.logoUrl,
      locationLabel: sharpeyeSurfboards.locationLabel,
      modelCount: sharpeyeSurfboards.models.length,
    },
    {
      slug: lostSurfboards.slug,
      kind: "brand",
      name: lostSurfboards.name,
      shortDescription: lostSurfboards.shortDescription,
      logoUrl: lostSurfboards.logoUrl,
      locationLabel: lostSurfboards.locationLabel,
      modelCount: lostSurfboards.models.length,
    },
    {
      slug: pyzelSurfboards.slug,
      kind: "brand",
      name: pyzelSurfboards.name,
      shortDescription: pyzelSurfboards.shortDescription,
      logoUrl: pyzelSurfboards.logoUrl,
      locationLabel: pyzelSurfboards.locationLabel,
      modelCount: pyzelSurfboards.models.length,
    },
    {
      slug: robertsSurfboards.slug,
      kind: "brand",
      name: robertsSurfboards.name,
      shortDescription: robertsSurfboards.shortDescription,
      logoUrl: robertsSurfboards.logoUrl,
      locationLabel: robertsSurfboards.locationLabel,
      modelCount: robertsSurfboards.models.length,
    },
    {
      slug: haydenShapes.slug,
      kind: "brand",
      name: haydenShapes.name,
      shortDescription: haydenShapes.shortDescription,
      logoUrl: haydenShapes.logoUrl,
      locationLabel: haydenShapes.locationLabel,
      modelCount: haydenShapes.models.length,
    },
    {
      slug: jsSurfboards.slug,
      kind: "brand",
      name: jsSurfboards.name,
      shortDescription: jsSurfboards.shortDescription,
      logoUrl: jsSurfboards.logoUrl,
      locationLabel: jsSurfboards.locationLabel,
      modelCount: jsSurfboards.models.length,
    },
    {
      slug: dhdSurfboards.slug,
      kind: "brand",
      name: dhdSurfboards.name,
      shortDescription: dhdSurfboards.shortDescription,
      logoUrl: dhdSurfboards.logoUrl,
      locationLabel: dhdSurfboards.locationLabel,
      modelCount: dhdSurfboards.models.length,
    },
  ]
}
