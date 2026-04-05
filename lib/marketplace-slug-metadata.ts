import type { Metadata } from "next"
import type { UsedGearSearchParams } from "@/components/used-gear-listings"
import { formatCategory, LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { browsePresetForSlug, type UsedCategoryBrowsePreset } from "@/lib/used-category-browse-registry"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { APPAREL_KIND_OPTIONS } from "@/lib/apparel-lifestyle-options"
import {
  COLLECTIBLE_TYPE_OPTIONS,
  COLLECTIBLE_ERA_OPTIONS,
} from "@/lib/collectible-options"

const CONDITION_LABELS = LISTING_CONDITION_LABELS

const BOARD_TYPE_LABELS: Record<string, string> = {
  shortboard: "Shortboards",
  longboard: "Longboards",
  funboard: "Funboards",
  fish: "Fish Boards",
  gun: "Gun Boards",
  foamie: "Foam / Soft-Top Boards",
  other: "Surfboards",
}

const BOARDS_CONDITION_LABELS = LISTING_CONDITION_LABELS

export type BoardsBrowseSearchParams = {
  type?: string
  condition?: string
  sort?: string
  q?: string
  location?: string
  page?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  radius?: string
  lat?: string
  lng?: string
}

export function metadataForAllGear(sp: UsedGearSearchParams): Metadata {
  const cond =
    sp.condition && sp.condition !== "all" ? CONDITION_LABELS[sp.condition] ?? "" : ""
  const title = `${[cond, "Used Surf Gear"].filter(Boolean).join(" ")} For Sale | Reswell`
  const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}used surf gear on Reswell — fins, wetsuits, leashes, apparel and more.`
  return { title, description, openGraph: { title, description } }
}

export function metadataForBoardsBrowse(sp: BoardsBrowseSearchParams): Metadata {
  const typeLabel =
    sp.type && sp.type !== "all" ? BOARD_TYPE_LABELS[sp.type] ?? "Surfboards" : "Surfboards"
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? BOARDS_CONDITION_LABELS[sp.condition] ?? ""
      : ""
  const locationLabel = sp.location ? ` in ${sp.location}` : ""

  const titleParts = [condLabel, typeLabel].filter(Boolean).join(" ")
  const title = `${titleParts}${locationLabel} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${typeLabel.toLowerCase()} for sale${locationLabel}.`,
    "Find shortboards, longboards, fish, and more from local surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/boards", publicSiteOrigin() + "/")
  if (sp.type && sp.type !== "all") canonical.searchParams.set("type", sp.type)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.location) canonical.searchParams.set("location", sp.location)
  if (sp.sort && sp.sort !== "newest") canonical.searchParams.set("sort", sp.sort)

  return {
    title,
    description,
    alternates: { canonical: canonical.toString() },
    openGraph: { title, description, type: "website" },
  }
}

export function metadataForUsedCategoryBrowse(
  categorySlug: string,
  categoryName: string,
  sp: UsedGearSearchParams,
): Metadata {
  const preset = browsePresetForSlug(categorySlug)
  const cond =
    sp.condition && sp.condition !== "all" ? CONDITION_LABELS[sp.condition] ?? "" : ""

  switch (preset) {
    case "fins": {
      const brand = sp.brand && sp.brand !== "all" ? sp.brand : ""
      const titleParts = [cond, brand, "Fins"].filter(Boolean).join(" ")
      const title = `${titleParts} For Sale | Reswell`
      const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}surf fins${brand ? " by " + brand : ""} on Reswell. Find Futures, FCS, single fins and more.`
      return { title, description, openGraph: { title, description } }
    }
    case "wetsuits": {
      const size = sp.size && sp.size !== "all" ? `Size ${sp.size}` : ""
      const titleParts = [cond, size, "Wetsuits"].filter(Boolean).join(" ")
      const title = `${titleParts} For Sale | Reswell`
      const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}used wetsuits${size ? " in " + size : ""} on Reswell. Find great deals from local surfers.`
      return { title, description, openGraph: { title, description } }
    }
    case "leashes": {
      const title = `${[cond, "Surf Leashes"].filter(Boolean).join(" ")} For Sale | Reswell`
      const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}surf leashes on Reswell. Find great deals from local surfers.`
      return { title, description, openGraph: { title, description } }
    }
    case "board-bags": {
      const kind =
        sp.boardBag === "day" ? "Day Bags" : sp.boardBag === "travel" ? "Travel Bags" : "Board Bags"
      const title = `${[cond, kind].filter(Boolean).join(" ")} For Sale | Reswell`
      const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}used surfboard bags on Reswell. Day bags and travel bags available.`
      return { title, description, openGraph: { title, description } }
    }
    case "apparel-lifestyle": {
      const apparelLabel =
        sp.apparel && sp.apparel !== "all"
          ? APPAREL_KIND_OPTIONS.find((o) => o.value === sp.apparel)?.label ?? sp.apparel
          : ""
      const title = `${[cond, apparelLabel, "Surf Apparel"].filter(Boolean).join(" ")} For Sale | Reswell`
      const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}used surf apparel and lifestyle gear on Reswell.`
      return { title, description, openGraph: { title, description } }
    }
    case "collectibles-vintage": {
      const typeLabel =
        sp.collectibleType && sp.collectibleType !== "all"
          ? COLLECTIBLE_TYPE_OPTIONS.find((o) => o.value === sp.collectibleType)?.label ?? ""
          : ""
      const eraLabel =
        sp.collectibleEra && sp.collectibleEra !== "all"
          ? COLLECTIBLE_ERA_OPTIONS.find((o) => o.value === sp.collectibleEra)?.label ?? ""
          : ""
      const title = `${[eraLabel, typeLabel, "Vintage Surf Collectibles"].filter(Boolean).join(" ")} | Reswell`
      const description = `Find rare vintage surf collectibles${typeLabel ? " — " + typeLabel : ""} on Reswell. Classic surf culture from ${eraLabel || "every era"}.`
      return { title, description, openGraph: { title, description } }
    }
    case "backpacks":
    case "generic": {
      const label = formatCategory(categoryName)
      const title = `${label} For Sale | Reswell`
      const description = `Shop pre-loved ${label.toLowerCase()} on Reswell — shipping available.`
      return { title, description, openGraph: { title, description } }
    }
  }
}
