/**
 * Canonical category links for the /categories page and header dropdown.
 * Surfboard types match the board style facet in `lib/boards-browse-facets` (`type`/`style` query params).
 */

import { BRANDS_BASE } from "@/lib/brands/routes"

export type CategoryLink = { label: string; href: string }

/** `/boards` root label — matches header nav and browse breadcrumbs. */
export const surfboardsBrowseRootLabel = "Surfboards"

export const surfboardBrowseLinks: CategoryLink[] = [
  { label: surfboardsBrowseRootLabel, href: "/boards" },
  { label: "Shortboard", href: "/boards?type=shortboard" },
  { label: "Groveler", href: "/boards?type=groveler" },
  { label: "Fish", href: "/boards?type=fish" },
  { label: "Asym", href: "/boards?type=asym" },
  { label: "Hybrid", href: "/boards?type=hybrid" },
  { label: "Longboard", href: "/boards?type=longboard" },
  { label: "Step-Up / Gun", href: "/boards?type=step-up-gun" },
  { label: "Other", href: "/boards?type=other" },
]

/** All peer gear browse routes (footer, /categories, sitemap — routes stay live). */
export const siteHeaderPeerProductNavLinks: CategoryLink[] = [
  { label: "Fins", href: "/fins" },
  { label: "Wetsuits", href: "/wetsuits" },
  { label: "Boardbags", href: "/boardbags" },
  { label: "Surfpacks", href: "/surfpacks" },
  { label: "Leashes", href: "/leashes" },
  { label: "Apparel", href: "/apparel" },
  { label: "Accessories", href: "/accessories" },
]

/** Peer gear shown in the desktop + mobile main category bar (others hidden until launch). */
export const siteHeaderMainPeerProductNavLinks: CategoryLink[] = [
  { label: "Fins", href: "/fins" },
  { label: "Wetsuits", href: "/wetsuits" },
  { label: "Magazines", href: "/magazines" },
]

/**
 * Full category rail — desktop header (Surfboards root, then Fins, Wetsuits, Magazines).
 * Shape browse links (`/boards?type=…`) stay on /categories and filters — not in the top rail.
 */
export const siteHeaderDesktopCategoryNavLinks: CategoryLink[] = [
  surfboardBrowseLinks[0],
  ...siteHeaderMainPeerProductNavLinks,
]

/**
 * Category pill strip — mobile/tablet category bar and hamburger menu.
 * Same category links as desktop (Surfboards + peer gear only).
 */
export const siteHeaderMobileCategoryNavLinks: CategoryLink[] = siteHeaderDesktopCategoryNavLinks
/** Header Categories dropdown + /categories page: surfboards only. */
export const allCategoriesForNav: CategoryLink[] = surfboardBrowseLinks

/**
 * Footer Categories column — Surfboards root plus peer gear (same as the header rail).
 * Shape browse links (`/boards?type=…`) stay on /categories and filters.
 */
export const footerCategoryLinks: CategoryLink[] = [
  surfboardBrowseLinks[0],
  ...siteHeaderMainPeerProductNavLinks,
]

export type CategoryDirectorySection = {
  title: string
  description?: string
  links: CategoryLink[]
}

/** `/fins` browse links — peer-to-peer surfboard fins. */
export const finBrowseLinks: CategoryLink[] = [
  { label: "All Fins", href: "/fins" },
  { label: "Thruster", href: "/fins?fin=thruster" },
  { label: "Twin", href: "/fins?fin=twin_only" },
  { label: "Quad", href: "/fins?fin=quad" },
  { label: "Single", href: "/fins?fin=single" },
]

export const wetsuitBrowseLinks: CategoryLink[] = [{ label: "All Wetsuits", href: "/wetsuits" }]

export const boardbagBrowseLinks: CategoryLink[] = [{ label: "All Boardbags", href: "/boardbags" }]

export const surfpackBrowseLinks: CategoryLink[] = [{ label: "All Surfpacks", href: "/surfpacks" }]

export const leashBrowseLinks: CategoryLink[] = [{ label: "All Leashes", href: "/leashes" }]

export const apparelBrowseLinks: CategoryLink[] = [{ label: "All Apparel", href: "/apparel" }]

export const accessoryBrowseLinks: CategoryLink[] = [
  { label: "All Accessories", href: "/accessories" },
]

export const categoryDirectorySections: CategoryDirectorySection[] = [
  {
    title: "Surfboards",
    description: "Local listings by board shape — inspect in person before you buy.",
    links: surfboardBrowseLinks,
  },
  {
    title: "Fins",
    description: "Used and pre-owned surfboard fins from surfers.",
    links: finBrowseLinks,
  },
  {
    title: "Wetsuits",
    description: "Used and pre-owned wetsuits from surfers.",
    links: wetsuitBrowseLinks,
  },
  {
    title: "Boardbags",
    description: "Used and pre-owned boardbags from surfers.",
    links: boardbagBrowseLinks,
  },
  {
    title: "Surfpacks",
    description: "Used and pre-owned surfpacks from surfers.",
    links: surfpackBrowseLinks,
  },
  {
    title: "Leashes",
    description: "Used and pre-owned leashes from surfers.",
    links: leashBrowseLinks,
  },
  {
    title: "Apparel",
    description: "Used and pre-owned surf apparel from surfers.",
    links: apparelBrowseLinks,
  },
  {
    title: "Accessories",
    description: "Used and pre-owned surf accessories from surfers.",
    links: accessoryBrowseLinks,
  },
]

/**
 * Whether a `/boards` or `/boards?type=…` nav link is active for the current URL.
 * Used by the header category bar and mobile category strip.
 */
export function boardBrowseNavItemIsActive(
  pathname: string | null,
  searchParams: Pick<URLSearchParams, "get">,
  href: string,
): boolean {
  if (!pathname) return false
  const q = href.indexOf("?")
  const path = q === -1 ? href : href.slice(0, q)
  const query = q === -1 ? null : href.slice(q + 1)

  if (!pathname.startsWith(path)) return false

  if (!query) {
    if (path === "/boards") {
      return (
        (pathname === path && !searchParams.get("type")) || pathname.startsWith(`${path}/`)
      )
    }
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  const required = new URLSearchParams(query)
  for (const key of new Set(required.keys())) {
    if (searchParams.get(key) !== required.get(key)) return false
  }
  return pathname === path
}

/** Desktop header right rail — Sellers, Brands, Sold. */
export const siteHeaderDesktopSecondaryNavLinks: CategoryLink[] = [
  { label: "Sellers", href: "/sellers" },
  { label: "Brands", href: BRANDS_BASE },
  { label: "Sold", href: "/sold" },
]

/** Mobile pill strip + hamburger — Brands, Sellers, Sold. */
export const siteHeaderMobileSecondaryNavLinks: CategoryLink[] = [
  { label: "Brands", href: BRANDS_BASE },
  { label: "Sellers", href: "/sellers" },
  { label: "Sold", href: "/sold" },
]
export function siteHeaderSecondaryNavItemIsActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  const q = href.indexOf("?")
  const pathOnly = (q === -1 ? href : href.slice(0, q)).replace(/\/$/, "") || "/"
  const normalized = pathname.replace(/\/$/, "") || "/"
  return normalized === pathOnly || normalized.startsWith(`${pathOnly}/`)
}

/* ------------------------------------------------------------------ */
/*  Advanced category directory — used by /categories page             */
/* ------------------------------------------------------------------ */

export type SubcategoryGroup = {
  heading: string
  links: CategoryLink[]
}

export type AdvancedCategorySection = {
  id: string
  title: string
  description: string
  browseAllHref: string
  browseAllLabel: string
  subcategories: SubcategoryGroup[]
}

export const advancedCategorySections: AdvancedCategorySection[] = [
  {
    id: "surfboards",
    title: "Surfboards",
    description:
      "Browse local surfboard listings by shape. Every board is listed by a real seller you can meet in person.",
    browseAllHref: "/boards",
    browseAllLabel: "View all surfboards",
    subcategories: [
      {
        heading: "By shape",
        links: [
          { label: "Shortboard", href: "/boards?type=shortboard" },
          { label: "Groveler", href: "/boards?type=groveler" },
          { label: "Fish", href: "/boards?type=fish" },
          { label: "Asym", href: "/boards?type=asym" },
          { label: "Hybrid", href: "/boards?type=hybrid" },
          { label: "Longboard", href: "/boards?type=longboard" },
          { label: "Step-Up / Gun", href: "/boards?type=step-up-gun" },
          { label: "Other", href: "/boards?type=other" },
        ],
      },
    ],
  },
  {
    id: "fins",
    title: "Fins",
    description:
      "Browse used surfboard fins by setup. Every set is listed by a real seller you can meet or have shipped.",
    browseAllHref: "/fins",
    browseAllLabel: "View all fins",
    subcategories: [
      {
        heading: "By setup",
        links: [
          { label: "Thruster", href: "/fins?fin=thruster" },
          { label: "Twin", href: "/fins?fin=twin_only" },
          { label: "Quad", href: "/fins?fin=quad" },
          { label: "Single", href: "/fins?fin=single" },
          { label: "5-fin", href: "/fins?fin=five" },
        ],
      },
    ],
  },
  {
    id: "wetsuits",
    title: "Wetsuits",
    description:
      "Browse used wetsuits by size and condition. Every suit is listed by a real seller you can meet or have shipped.",
    browseAllHref: "/wetsuits",
    browseAllLabel: "View all wetsuits",
    subcategories: [{ heading: "Wetsuits", links: wetsuitBrowseLinks }],
  },
  {
    id: "boardbags",
    title: "Boardbags",
    description:
      "Browse used boardbags by condition. Every bag is listed by a real seller you can meet or have shipped.",
    browseAllHref: "/boardbags",
    browseAllLabel: "View all boardbags",
    subcategories: [{ heading: "Boardbags", links: boardbagBrowseLinks }],
  },
  {
    id: "surfpacks",
    title: "Surfpacks",
    description:
      "Browse used surfpacks by condition. Every pack is listed by a real seller you can meet or have shipped.",
    browseAllHref: "/surfpacks",
    browseAllLabel: "View all surfpacks",
    subcategories: [{ heading: "Surfpacks", links: surfpackBrowseLinks }],
  },
  {
    id: "leashes",
    title: "Leashes",
    description:
      "Browse used leashes by condition. Every leash is listed by a real seller you can meet or have shipped.",
    browseAllHref: "/leashes",
    browseAllLabel: "View all leashes",
    subcategories: [{ heading: "Leashes", links: leashBrowseLinks }],
  },
  {
    id: "apparel",
    title: "Apparel",
    description:
      "Browse used surf apparel by condition. Every item is listed by a real seller you can meet or have shipped.",
    browseAllHref: "/apparel",
    browseAllLabel: "View all apparel",
    subcategories: [{ heading: "Apparel", links: apparelBrowseLinks }],
  },
  {
    id: "accessories",
    title: "Accessories",
    description:
      "Browse used surf accessories by condition. Every item is listed by a real seller you can meet or have shipped.",
    browseAllHref: "/accessories",
    browseAllLabel: "View all accessories",
    subcategories: [{ heading: "Accessories", links: accessoryBrowseLinks }],
  },
]

const HEADER_CATEGORIES_DROPDOWN_IDS = new Set([
  "surfboards",
  "fins",
  "wetsuits",
  "boardbags",
  "surfpacks",
  "leashes",
  "apparel",
  "accessories",
])

/** Surfboard shapes shown in the header Categories dropdown only (full list stays on /categories). */
const headerSurfboardsDropdownShapes: CategoryLink[] = [
  { label: "Shortboard", href: "/boards?type=shortboard" },
  { label: "Groveler", href: "/boards?type=groveler" },
  { label: "Longboard", href: "/boards?type=longboard" },
]

/** Fin setups shown in the header Categories dropdown only (full list stays on /categories). */
const headerFinsDropdownSetups: CategoryLink[] = [
  { label: "Thruster", href: "/fins?fin=thruster" },
  { label: "Twin", href: "/fins?fin=twin_only" },
  { label: "Quad", href: "/fins?fin=quad" },
]

/** Subcategory submenus in the header Categories dropdown only (all sections remain on /categories). */
export const headerCategoriesDropdownSections: AdvancedCategorySection[] =
  advancedCategorySections
    .filter((s) => HEADER_CATEGORIES_DROPDOWN_IDS.has(s.id))
    .map((s) => {
      if (s.id === "surfboards") {
        return {
          ...s,
          subcategories: [{ heading: "Surfboards", links: headerSurfboardsDropdownShapes }],
        }
      }
      if (s.id === "fins") {
        return {
          ...s,
          subcategories: [{ heading: "Fins", links: headerFinsDropdownSetups }],
        }
      }
      return s
    })
