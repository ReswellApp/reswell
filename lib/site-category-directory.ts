/**
 * Canonical category links for the /categories page and header dropdown.
 * Surfboard types match the board style facet in `lib/boards-browse-facets` (`type`/`style` query params).
 */

import { BRANDS_BASE } from "@/lib/brands/routes"

export type CategoryLink = { label: string; href: string }

/** `/boards` root label — matches header nav and browse breadcrumbs. */
export const surfboardsBrowseRootLabel = "All Surfboards"

export const surfboardBrowseLinks: CategoryLink[] = [
  { label: surfboardsBrowseRootLabel, href: "/boards" },
  { label: "Shortboard", href: "/boards?type=shortboard" },
  { label: "Groveler", href: "/boards?type=groveler" },
  { label: "Hybrid", href: "/boards?type=hybrid" },
  { label: "Longboard", href: "/boards?type=longboard" },
  { label: "Step-Up / Gun", href: "/boards?type=step-up-gun" },
  { label: "Other", href: "/boards?type=other" },
]

/** Header Categories dropdown + /categories page: surfboards only. */
export const allCategoriesForNav: CategoryLink[] = surfboardBrowseLinks

/** Footer Categories column: board shapes only (no “All Surfboards” or “Other”). */
export const footerCategoryLinks: CategoryLink[] = surfboardBrowseLinks.filter(
  (link) => link.href !== "/boards" && link.href !== "/boards?type=other"
)

export type CategoryDirectorySection = {
  title: string
  description?: string
  links: CategoryLink[]
}

export const categoryDirectorySections: CategoryDirectorySection[] = [
  {
    title: "Surfboards",
    description: "Local listings by board shape — inspect in person before you buy.",
    links: surfboardBrowseLinks,
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

/** Sellers, Brands — desktop header rail, mobile strip, hamburger. */
export const siteHeaderSecondaryNavLinks: CategoryLink[] = [
  { label: "Sellers", href: "/sellers" },
  { label: "Brands", href: BRANDS_BASE },
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
          { label: "Hybrid", href: "/boards?type=hybrid" },
          { label: "Longboard", href: "/boards?type=longboard" },
          { label: "Step-Up / Gun", href: "/boards?type=step-up-gun" },
          { label: "Other", href: "/boards?type=other" },
        ],
      },
    ],
  },
]

const HEADER_CATEGORIES_DROPDOWN_IDS = new Set(["surfboards"])

/** Surfboard shapes shown in the header Categories dropdown only (full list stays on /categories). */
const headerSurfboardsDropdownShapes: CategoryLink[] = [
  { label: "Shortboard", href: "/boards?type=shortboard" },
  { label: "Groveler", href: "/boards?type=groveler" },
  { label: "Longboard", href: "/boards?type=longboard" },
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
      return s
    })
