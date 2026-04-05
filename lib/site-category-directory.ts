/**
 * Canonical category links for the /categories page and header dropdown.
 * Surfboard types match `components/boards-listings-filters` (`type` query param).
 */

export type CategoryLink = { label: string; href: string }

export const surfboardBrowseLinks: CategoryLink[] = [
  { label: "All surfboards", href: "/boards" },
  { label: "Shortboard", href: "/boards?type=shortboard" },
  { label: "Longboard", href: "/boards?type=longboard" },
  { label: "Funboard / Mid-length", href: "/boards?type=funboard" },
  { label: "Fish", href: "/boards?type=fish" },
  { label: "Gun", href: "/boards?type=gun" },
  { label: "Foam / Soft Top", href: "/boards?type=foamie" },
  { label: "Other", href: "/boards?type=other" },
]

/** Every used-gear category filter (browse URLs at site root + /gear). Includes browse-all for nav dropdown. */
export const usedCategoryLinks: CategoryLink[] = [
  { label: "Wetsuits", href: "/wetsuits" },
  { label: "Apparel & Lifestyle", href: "/apparel-lifestyle" },
  { label: "Fins", href: "/fins" },
  { label: "Leashes", href: "/leashes" },
  { label: "Board Bags", href: "/board-bags" },
  { label: "Surfpacks & Bags", href: "/backpacks" },
  { label: "Vintage", href: "/collectibles-vintage" },
  { label: "All Gear", href: "/gear" },
]

/** Full list for the Categories dropdown (includes surfboards for deep links). */
export const allCategoriesForNav: CategoryLink[] = [
  { label: "Surfboards", href: "/boards" },
  ...usedCategoryLinks,
]

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
  {
    title: "Wetsuits & apparel",
    description: "Rubber and everyday surf lifestyle pieces from the community.",
    links: [
      { label: "Wetsuits", href: "/wetsuits" },
      { label: "Apparel & Lifestyle", href: "/apparel-lifestyle" },
    ],
  },
  {
    title: "Fins & essentials",
    description: "Fins and leashes for your setup.",
    links: [
      { label: "Fins", href: "/fins" },
      { label: "Leashes", href: "/leashes" },
    ],
  },
  {
    title: "Bags & travel",
    description: "Board bags and packs for sessions and trips.",
    links: [
      { label: "Board Bags", href: "/board-bags" },
      { label: "Surfpacks & Bags", href: "/backpacks" },
    ],
  },
  {
    title: "Vintage",
    description: "Rare finds and classic surf culture.",
    links: [{ label: "Vintage", href: "/collectibles-vintage" }],
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
          { label: "Longboard", href: "/boards?type=longboard" },
          { label: "Funboard / Mid-length", href: "/boards?type=funboard" },
          { label: "Fish", href: "/boards?type=fish" },
          { label: "Gun", href: "/boards?type=gun" },
          { label: "Foam / Soft Top", href: "/boards?type=foamie" },
          { label: "Other", href: "/boards?type=other" },
        ],
      },
    ],
  },
  {
    id: "wetsuits",
    title: "Wetsuits",
    description:
      "Find wetsuits by zip style, thickness, or size. Filter down to exactly what you need.",
    browseAllHref: "/wetsuits",
    browseAllLabel: "View all wetsuits",
    subcategories: [
      {
        heading: "By zip style",
        links: [
          { label: "Hooded", href: "/wetsuits?zipType=hooded" },
          { label: "Chestzip", href: "/wetsuits?zipType=chestzip" },
          { label: "Backzip", href: "/wetsuits?zipType=backzip" },
        ],
      },
      {
        heading: "By thickness",
        links: [
          { label: "2/2mm", href: "/wetsuits?thickness=2/2" },
          { label: "3/2mm", href: "/wetsuits?thickness=3/2" },
          { label: "4/3mm", href: "/wetsuits?thickness=4/3" },
          { label: "5/4mm", href: "/wetsuits?thickness=5/4" },
          { label: "6/4/3mm", href: "/wetsuits?thickness=6/4/3" },
          { label: "6/5mm", href: "/wetsuits?thickness=6/5" },
        ],
      },
      {
        heading: "By size",
        links: [
          { label: "XS", href: "/wetsuits?size=XS" },
          { label: "S", href: "/wetsuits?size=S" },
          { label: "M", href: "/wetsuits?size=M" },
          { label: "MS", href: "/wetsuits?size=MS" },
          { label: "MT", href: "/wetsuits?size=MT" },
          { label: "L", href: "/wetsuits?size=L" },
          { label: "LS", href: "/wetsuits?size=LS" },
          { label: "LT", href: "/wetsuits?size=LT" },
          { label: "XL", href: "/wetsuits?size=XL" },
          { label: "XLS", href: "/wetsuits?size=XLS" },
          { label: "XLT", href: "/wetsuits?size=XLT" },
          { label: "XXL", href: "/wetsuits?size=XXL" },
        ],
      },
    ],
  },
  {
    id: "apparel",
    title: "Apparel & Lifestyle",
    description:
      "Boardshorts, shirts, bikinis, jackets, and more — everyday surf lifestyle pieces from the community.",
    browseAllHref: "/apparel-lifestyle",
    browseAllLabel: "View all apparel",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "Shirts", href: "/apparel-lifestyle?apparel=shirt" },
          { label: "Boardshorts", href: "/apparel-lifestyle?apparel=boardshorts" },
          { label: "Bikinis", href: "/apparel-lifestyle?apparel=bikini" },
          { label: "Jackets", href: "/apparel-lifestyle?apparel=jacket" },
          { label: "Changing Towels", href: "/apparel-lifestyle?apparel=changing_towel" },
          { label: "Towels", href: "/apparel-lifestyle?apparel=towel" },
        ],
      },
      {
        heading: "By size",
        links: [
          { label: "XS", href: "/apparel-lifestyle?size=XS" },
          { label: "S", href: "/apparel-lifestyle?size=S" },
          { label: "M", href: "/apparel-lifestyle?size=M" },
          { label: "L", href: "/apparel-lifestyle?size=L" },
          { label: "XL", href: "/apparel-lifestyle?size=XL" },
        ],
      },
    ],
  },
  {
    id: "fins",
    title: "Fins",
    description: "Single fins, thrusters, quads, and more. Filter by size and condition.",
    browseAllHref: "/fins",
    browseAllLabel: "View all fins",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "FCS", href: "/fins?brand=FCS" },
          { label: "Futures", href: "/fins?brand=Futures" },
          { label: "Single Fin", href: "/fins?brand=Single%20Fin" },
        ],
      },
      {
        heading: "By size",
        links: [
          { label: "XS", href: "/fins?size=XS" },
          { label: "S", href: "/fins?size=S" },
          { label: "M", href: "/fins?size=M" },
          { label: "L", href: "/fins?size=L" },
        ],
      },
      {
        heading: "By condition",
        links: [
          { label: "New", href: "/fins?condition=new" },
          { label: "Excellent", href: "/fins?condition=like_new" },
          { label: "Good", href: "/fins?condition=good" },
          { label: "Fair", href: "/fins?condition=fair" },
        ],
      },
    ],
  },
  {
    id: "leashes",
    title: "Leashes",
    description: "Comp leashes to big-wave leashes — browse by length and cord thickness.",
    browseAllHref: "/leashes",
    browseAllLabel: "View all leashes",
    subcategories: [
      {
        heading: "By length",
        links: [
          { label: "6 ft", href: "/leashes?leashLength=6" },
          { label: "8 ft", href: "/leashes?leashLength=8" },
          { label: "9 ft", href: "/leashes?leashLength=9" },
          { label: "10 ft", href: "/leashes?leashLength=10" },
        ],
      },
      {
        heading: "By cord thickness",
        links: [
          { label: `3/16"`, href: "/leashes?leashThickness=3%2F16" },
          { label: `1/4"`, href: "/leashes?leashThickness=1%2F4" },
          { label: `5/16"`, href: "/leashes?leashThickness=5%2F16" },
        ],
      },
    ],
  },
  {
    id: "board-bags",
    title: "Board Bags",
    description:
      "Day bags and travel coffins — find the right protection for your board.",
    browseAllHref: "/board-bags",
    browseAllLabel: "View all board bags",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "Day Bags", href: "/board-bags?boardBag=day" },
          { label: "Travel Bags", href: "/board-bags?boardBag=travel" },
        ],
      },
      {
        heading: "By size (fits up to)",
        links: [
          { label: `5'8"`, href: `/board-bags?size=5'8"` },
          { label: `6'0"`, href: `/board-bags?size=6'0"` },
          { label: `6'3"`, href: `/board-bags?size=6'3"` },
          { label: `6'6"`, href: `/board-bags?size=6'6"` },
          { label: `7'0"`, href: `/board-bags?size=7'0"` },
          { label: `7'6"`, href: `/board-bags?size=7'6"` },
          { label: `8'0"`, href: `/board-bags?size=8'0"` },
          { label: `8'6"`, href: `/board-bags?size=8'6"` },
          { label: `9'0"`, href: `/board-bags?size=9'0"` },
          { label: `9'6"`, href: `/board-bags?size=9'6"` },
        ],
      },
    ],
  },
  {
    id: "surfpacks",
    title: "Surfpacks & Bags",
    description: "Waterproof backpacks and gear bags built for surfers on the go.",
    browseAllHref: "/backpacks",
    browseAllLabel: "View all surfpacks & bags",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "Surfpacks", href: "/backpacks?pack=surfpack" },
          { label: "Bags", href: "/backpacks?pack=bag" },
        ],
      },
    ],
  },
  {
    id: "collectibles",
    title: "Vintage",
    description:
      "Rare finds and classic surf culture — vintage boards, apparel, art, media, and more.",
    browseAllHref: "/collectibles-vintage",
    browseAllLabel: "View all vintage",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "Vintage Surfboards", href: "/collectibles-vintage?collectibleType=vintage_surfboards" },
          { label: "Vintage Apparel", href: "/collectibles-vintage?collectibleType=vintage_apparel" },
          { label: "Surf Art & Prints", href: "/collectibles-vintage?collectibleType=surf_art" },
          { label: "Media & Magazines", href: "/collectibles-vintage?collectibleType=media_magazines" },
          { label: "Vintage Gear", href: "/collectibles-vintage?collectibleType=vintage_gear" },
          { label: "Rare & Archive", href: "/collectibles-vintage?collectibleType=rare_archive" },
        ],
      },
      {
        heading: "By era",
        links: [
          { label: "1970s", href: "/collectibles-vintage?collectibleEra=70s" },
          { label: "1980s", href: "/collectibles-vintage?collectibleEra=80s" },
          { label: "1990s", href: "/collectibles-vintage?collectibleEra=90s" },
          { label: "2000s", href: "/collectibles-vintage?collectibleEra=2000s" },
        ],
      },
      {
        heading: "By condition",
        links: [
          { label: "Mint", href: "/collectibles-vintage?collectibleCondition=mint" },
          { label: "Good", href: "/collectibles-vintage?collectibleCondition=good" },
          { label: "Restored", href: "/collectibles-vintage?collectibleCondition=restored" },
          { label: "Display Only", href: "/collectibles-vintage?collectibleCondition=display_only" },
        ],
      },
    ],
  },
]

const HEADER_CATEGORIES_DROPDOWN_IDS = new Set(["surfboards", "fins", "surfpacks"])

/** Surfboard shapes shown in the header Categories dropdown only (full list stays on /categories). */
const headerSurfboardsDropdownShapes: CategoryLink[] = [
  { label: "Shortboard", href: "/boards?type=shortboard" },
  { label: "Fish", href: "/boards?type=fish" },
  { label: "Longboard", href: "/boards?type=longboard" },
]

/** Fin types in the header Categories dropdown (`brand` query on /fins). */
const headerFinsDropdownBrands: CategoryLink[] = [
  { label: "FCS", href: "/fins?brand=FCS" },
  { label: "Futures", href: "/fins?brand=Futures" },
  { label: "Single Fin", href: "/fins?brand=Single%20Fin" },
]

/** Surfpacks vs bags in the header Categories dropdown (`pack` matches backpacks filters). */
const headerSurfpacksDropdownTypes: CategoryLink[] = [
  { label: "Surfpacks", href: "/backpacks?pack=surfpack" },
  { label: "Bags", href: "/backpacks?pack=bag" },
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
          subcategories: [{ heading: "Fins", links: headerFinsDropdownBrands }],
        }
      }
      if (s.id === "surfpacks") {
        return {
          ...s,
          subcategories: [{ heading: "Surfpacks & Bags", links: headerSurfpacksDropdownTypes }],
        }
      }
      return s
    })
