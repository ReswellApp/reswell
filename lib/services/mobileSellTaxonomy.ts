import {
  MOBILE_LISTING_CATEGORIES,
  mobileSellTaxonomySchema,
  type MobileListingCategory,
  type MobileSellTaxonomy,
} from "@reswell/api-contract"
import { BOARD_STYLE_OPTIONS } from "@/lib/boards-browse-facets"
import {
  siteHeaderMainPeerProductNavLinks,
  siteHeaderPeerProductNavLinks,
  surfboardBrowseLinks,
} from "@/lib/site-category-directory"

const HREF_BY_CATEGORY: Record<MobileListingCategory, string> = {
  surfboards: "/boards",
  fins: "/fins",
  traction: "/traction",
  wetsuits: "/wetsuits",
  apparel: "/apparel",
  magazines: "/magazines",
  boardbags: "/boardbags",
  surfpacks: "/surfpacks",
  leashes: "/leashes",
  accessories: "/accessories",
}

const LABEL_BY_HREF = new Map(
  [surfboardBrowseLinks[0], ...siteHeaderPeerProductNavLinks, ...siteHeaderMainPeerProductNavLinks].map((link) => [
    link.href,
    link.label,
  ]),
)

function labelFor(slug: MobileListingCategory): string {
  const label = LABEL_BY_HREF.get(HREF_BY_CATEGORY[slug])
  if (!label) throw new Error(`Missing sell category label for ${slug}`)
  return label
}

/** Categories and subcategories for the sell flow. Surfboard subcategories are the board-style filters. */
export function getMobileSellTaxonomy(): MobileSellTaxonomy {
  const boardStyles = BOARD_STYLE_OPTIONS.map((option) => ({
    slug: option.value,
    label: option.label,
  }))

  return mobileSellTaxonomySchema.parse({
    categories: MOBILE_LISTING_CATEGORIES.map((slug) => ({
      slug,
      label: labelFor(slug),
      subcategory_label: slug === "surfboards" ? "Board style" : null,
      subcategories: slug === "surfboards" ? boardStyles : [],
    })),
  })
}
