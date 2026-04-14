/**
 * Canonical category links for the /categories page and header dropdown.
 * Surfboard types match `components/boards-listings-filters` (`type` query param).
 */

export type CategoryLink = { label: string; href: string }

export const surfboardBrowseLinks: CategoryLink[] = [
  { label: "All Surfboards", href: "/boards" },
  { label: "Shortboard", href: "/boards?type=shortboard" },
  { label: "Groveler", href: "/boards?type=groveler" },
  { label: "Hybrid", href: "/boards?type=hybrid" },
  { label: "Longboard", href: "/boards?type=longboard" },
  { label: "Step-Up", href: "/boards?type=step-up" },
  { label: "Gun", href: "/boards?type=gun" },
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
          { label: "Step-Up", href: "/boards?type=step-up" },
          { label: "Gun", href: "/boards?type=gun" },
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
