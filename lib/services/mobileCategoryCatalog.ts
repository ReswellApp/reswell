import {
  mobileCategorySchema,
  type MobileCategory,
  type MobileListingCategory,
} from "@reswell/api-contract"
import { APPAREL_CONDITION_OPTIONS } from "@/lib/apparel-browse-facets"
import { APPAREL_KIND_OPTIONS, APPAREL_SIZE_OPTIONS } from "@/lib/apparel-listing-config"
import { ACCESSORY_CONDITION_OPTIONS } from "@/lib/accessories-browse-facets"
import { BOARDBAG_CONDITION_OPTIONS } from "@/lib/boardbags-browse-facets"
import {
  BOARD_STYLE_OPTIONS,
  CONDITION_OPTIONS,
  CONSTRUCTION_OPTIONS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  LENGTH_BUCKETS,
  VOLUME_BUCKETS,
} from "@/lib/boards-browse-facets"
import { FIN_CONDITION_OPTIONS } from "@/lib/fins-browse-facets"
import { FIN_SIZE_OPTIONS, FIN_SYSTEM_OPTIONS_FOR_FINS } from "@/lib/fin-listing-config"
import { LEASH_CONDITION_OPTIONS } from "@/lib/leashes-browse-facets"
import { MAGAZINE_CONDITION_OPTIONS } from "@/lib/magazines-browse-facets"
import { SURFPACK_CONDITION_OPTIONS } from "@/lib/surfpacks-browse-facets"
import { TRACTION_CONDITION_OPTIONS } from "@/lib/traction-browse-facets"
import { TRACTION_SIZE_OPTIONS } from "@/lib/traction-listing-config"
import { WETSUIT_CONDITION_OPTIONS } from "@/lib/wetsuits-browse-facets"
import { WETSUIT_SIZE_OPTIONS } from "@/lib/wetsuit-listing-config"
import { absoluteUrl } from "@/lib/site-metadata"

type FacetOption = { value: string; label: string }

type CategoryPhoto = { path: string; position: string }

const SORTS = [
  { id: "relevant", label: "Most Relevant" },
  { id: "newest", label: "Newest" },
  { id: "price-low", label: "Price: Low to high" },
  { id: "price-high", label: "Price: High to low" },
] as const

const TITLES: Record<MobileListingCategory, string> = {
  surfboards: "Surfboards",
  fins: "Fins",
  traction: "Traction",
  wetsuits: "Wetsuits",
  apparel: "Apparel",
  magazines: "Magazines",
  boardbags: "Boardbags",
  surfpacks: "Surfpacks",
  leashes: "Leashes",
  accessories: "Accessories",
}

/** Same atmosphere files the website category headers import. */
const PHOTOS: Partial<Record<MobileListingCategory, CategoryPhoto>> = {
  surfboards: { path: "/images/brand/boards-browse-barrel.jpg", position: "38% 72%" },
  fins: { path: "/images/brand/fiji-underboard.jpg", position: "center 26%" },
  wetsuits: { path: "/images/brand/wetsuits-browse-atmosphere.jpg", position: "center 48%" },
  apparel: { path: "/images/brand/apparel-browse-atmosphere.jpg", position: "center 46%" },
}

function facet(id: string, label: string, rows: readonly FacetOption[]) {
  if (rows.length === 0) return null
  return { id, label, options: rows.map((row) => ({ value: row.value, label: row.label })) }
}

function facetsFor(slug: MobileListingCategory) {
  const groups = (() => {
    switch (slug) {
      case "surfboards":
        return [
          facet("style", "Board style", BOARD_STYLE_OPTIONS),
          facet("condition", "Condition", CONDITION_OPTIONS),
          facet("length", "Length", LENGTH_BUCKETS),
          facet("volume", "Volume", VOLUME_BUCKETS),
          facet("fin", "Fin setup", FIN_SETUP_OPTIONS),
          facet("finSystem", "Fin system", FIN_SYSTEM_OPTIONS),
          facet("construction", "Construction", CONSTRUCTION_OPTIONS),
        ]
      case "fins":
        return [
          facet("fin", "Fin setup", FIN_SETUP_OPTIONS),
          facet("finSystem", "Fin system", FIN_SYSTEM_OPTIONS_FOR_FINS),
          facet("size", "Size", FIN_SIZE_OPTIONS),
          facet("condition", "Condition", FIN_CONDITION_OPTIONS),
        ]
      case "wetsuits":
        return [
          facet("size", "Size", WETSUIT_SIZE_OPTIONS),
          facet("condition", "Condition", WETSUIT_CONDITION_OPTIONS),
        ]
      case "traction":
        return [
          facet("size", "Size", TRACTION_SIZE_OPTIONS),
          facet("condition", "Condition", TRACTION_CONDITION_OPTIONS),
        ]
      case "apparel":
        return [
          facet("kind", "Type", APPAREL_KIND_OPTIONS),
          facet("size", "Size", APPAREL_SIZE_OPTIONS),
          facet("condition", "Condition", APPAREL_CONDITION_OPTIONS),
        ]
      case "leashes":
        return [facet("condition", "Condition", LEASH_CONDITION_OPTIONS)]
      case "boardbags":
        return [facet("condition", "Condition", BOARDBAG_CONDITION_OPTIONS)]
      case "surfpacks":
        return [facet("condition", "Condition", SURFPACK_CONDITION_OPTIONS)]
      case "accessories":
        return [facet("condition", "Condition", ACCESSORY_CONDITION_OPTIONS)]
      case "magazines":
        return [facet("condition", "Condition", MAGAZINE_CONDITION_OPTIONS)]
    }
  })()
  return groups.filter((group) => group != null)
}

export function mobileCategoryFor(slug: MobileListingCategory): MobileCategory {
  const photo = PHOTOS[slug]
  const category = {
    slug,
    title: TITLES[slug],
    image_url: photo ? absoluteUrl(photo.path) : null,
    image_position: photo?.position ?? null,
    ship: slug === "surfboards",
    sorts: SORTS,
    facets: facetsFor(slug),
  }
  return mobileCategorySchema.parse(category)
}
