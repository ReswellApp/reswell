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

/** Every used-gear category filter (slug on /used). Includes browse-all for nav dropdown. */
export const usedCategoryLinks: CategoryLink[] = [
  { label: "All Gear", href: "/used" },
  { label: "Wetsuits", href: "/used/wetsuits" },
  { label: "Apparel & Lifestyle", href: "/used/apparel-lifestyle" },
  { label: "Fins", href: "/used/fins" },
  { label: "Leashes", href: "/used/leashes" },
  { label: "Board Bags", href: "/used/board-bags" },
  { label: "Surfpacks & Bags", href: "/used/backpacks" },
  { label: "Collectibles & Vintage", href: "/used/collectibles-vintage" },
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
      { label: "Wetsuits", href: "/used/wetsuits" },
      { label: "Apparel & Lifestyle", href: "/used/apparel-lifestyle" },
    ],
  },
  {
    title: "Fins & essentials",
    description: "Fins and leashes for your setup.",
    links: [
      { label: "Fins", href: "/used/fins" },
      { label: "Leashes", href: "/used/leashes" },
    ],
  },
  {
    title: "Bags & travel",
    description: "Board bags and packs for sessions and trips.",
    links: [
      { label: "Board Bags", href: "/used/board-bags" },
      { label: "Surfpacks & Bags", href: "/used/backpacks" },
    ],
  },
  {
    title: "Collectibles & vintage",
    description: "Rare finds and classic surf culture.",
    links: [{ label: "Collectibles & Vintage", href: "/used/collectibles-vintage" }],
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
    browseAllHref: "/used/wetsuits",
    browseAllLabel: "View all wetsuits",
    subcategories: [
      {
        heading: "By zip style",
        links: [
          { label: "Hooded", href: "/used/wetsuits?zipType=hooded" },
          { label: "Chestzip", href: "/used/wetsuits?zipType=chestzip" },
          { label: "Backzip", href: "/used/wetsuits?zipType=backzip" },
        ],
      },
      {
        heading: "By thickness",
        links: [
          { label: "2/2mm", href: "/used/wetsuits?thickness=2/2" },
          { label: "3/2mm", href: "/used/wetsuits?thickness=3/2" },
          { label: "4/3mm", href: "/used/wetsuits?thickness=4/3" },
          { label: "5/4mm", href: "/used/wetsuits?thickness=5/4" },
          { label: "6/4/3mm", href: "/used/wetsuits?thickness=6/4/3" },
          { label: "6/5mm", href: "/used/wetsuits?thickness=6/5" },
        ],
      },
      {
        heading: "By size",
        links: [
          { label: "XS", href: "/used/wetsuits?size=XS" },
          { label: "S", href: "/used/wetsuits?size=S" },
          { label: "M", href: "/used/wetsuits?size=M" },
          { label: "MS", href: "/used/wetsuits?size=MS" },
          { label: "MT", href: "/used/wetsuits?size=MT" },
          { label: "L", href: "/used/wetsuits?size=L" },
          { label: "LS", href: "/used/wetsuits?size=LS" },
          { label: "LT", href: "/used/wetsuits?size=LT" },
          { label: "XL", href: "/used/wetsuits?size=XL" },
          { label: "XLS", href: "/used/wetsuits?size=XLS" },
          { label: "XLT", href: "/used/wetsuits?size=XLT" },
          { label: "XXL", href: "/used/wetsuits?size=XXL" },
        ],
      },
    ],
  },
  {
    id: "apparel",
    title: "Apparel & Lifestyle",
    description:
      "Boardshorts, shirts, bikinis, jackets, and more — everyday surf lifestyle pieces from the community.",
    browseAllHref: "/used/apparel-lifestyle",
    browseAllLabel: "View all apparel",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "Shirts", href: "/used/apparel-lifestyle?apparel=shirt" },
          { label: "Boardshorts", href: "/used/apparel-lifestyle?apparel=boardshorts" },
          { label: "Bikinis", href: "/used/apparel-lifestyle?apparel=bikini" },
          { label: "Jackets", href: "/used/apparel-lifestyle?apparel=jacket" },
          { label: "Changing Towels", href: "/used/apparel-lifestyle?apparel=changing_towel" },
          { label: "Towels", href: "/used/apparel-lifestyle?apparel=towel" },
        ],
      },
      {
        heading: "By size",
        links: [
          { label: "XS", href: "/used/apparel-lifestyle?size=XS" },
          { label: "S", href: "/used/apparel-lifestyle?size=S" },
          { label: "M", href: "/used/apparel-lifestyle?size=M" },
          { label: "L", href: "/used/apparel-lifestyle?size=L" },
          { label: "XL", href: "/used/apparel-lifestyle?size=XL" },
        ],
      },
    ],
  },
  {
    id: "fins",
    title: "Fins",
    description: "Single fins, thrusters, quads, and more. Filter by size and condition.",
    browseAllHref: "/used/fins",
    browseAllLabel: "View all fins",
    subcategories: [
      {
        heading: "By size",
        links: [
          { label: "XS", href: "/used/fins?size=XS" },
          { label: "S", href: "/used/fins?size=S" },
          { label: "M", href: "/used/fins?size=M" },
          { label: "L", href: "/used/fins?size=L" },
        ],
      },
      {
        heading: "By condition",
        links: [
          { label: "New", href: "/used/fins?condition=new" },
          { label: "Like New", href: "/used/fins?condition=like_new" },
          { label: "Good", href: "/used/fins?condition=good" },
          { label: "Fair", href: "/used/fins?condition=fair" },
        ],
      },
    ],
  },
  {
    id: "leashes",
    title: "Leashes",
    description: "Comp leashes to big-wave leashes — browse by length and cord thickness.",
    browseAllHref: "/used/leashes",
    browseAllLabel: "View all leashes",
    subcategories: [
      {
        heading: "By length",
        links: [
          { label: "5'", href: "/used/leashes?leashLength=5" },
          { label: "6'", href: "/used/leashes?leashLength=6" },
          { label: "7'", href: "/used/leashes?leashLength=7" },
          { label: "8'", href: "/used/leashes?leashLength=8" },
          { label: "9'", href: "/used/leashes?leashLength=9" },
          { label: "10'", href: "/used/leashes?leashLength=10" },
          { label: "11'", href: "/used/leashes?leashLength=11" },
          { label: "12'", href: "/used/leashes?leashLength=12" },
        ],
      },
      {
        heading: "By cord thickness",
        links: [
          { label: "5mm", href: "/used/leashes?leashThickness=5mm" },
          { label: "6mm", href: "/used/leashes?leashThickness=6mm" },
          { label: "7mm", href: "/used/leashes?leashThickness=7mm" },
          { label: "8mm", href: "/used/leashes?leashThickness=8mm" },
          { label: "9mm", href: "/used/leashes?leashThickness=9mm" },
          { label: "10mm", href: "/used/leashes?leashThickness=10mm" },
        ],
      },
    ],
  },
  {
    id: "board-bags",
    title: "Board Bags",
    description:
      "Day bags and travel coffins — find the right protection for your board.",
    browseAllHref: "/used/board-bags",
    browseAllLabel: "View all board bags",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "Day Bags", href: "/used/board-bags?boardBag=day" },
          { label: "Travel Bags", href: "/used/board-bags?boardBag=travel" },
        ],
      },
      {
        heading: "By size (fits up to)",
        links: [
          { label: `5'8"`, href: `/used/board-bags?size=5'8"` },
          { label: `6'0"`, href: `/used/board-bags?size=6'0"` },
          { label: `6'3"`, href: `/used/board-bags?size=6'3"` },
          { label: `6'6"`, href: `/used/board-bags?size=6'6"` },
          { label: `7'0"`, href: `/used/board-bags?size=7'0"` },
          { label: `7'6"`, href: `/used/board-bags?size=7'6"` },
          { label: `8'0"`, href: `/used/board-bags?size=8'0"` },
          { label: `8'6"`, href: `/used/board-bags?size=8'6"` },
          { label: `9'0"`, href: `/used/board-bags?size=9'0"` },
          { label: `9'6"`, href: `/used/board-bags?size=9'6"` },
        ],
      },
    ],
  },
  {
    id: "surfpacks",
    title: "Surfpacks & Bags",
    description: "Waterproof backpacks and gear bags built for surfers on the go.",
    browseAllHref: "/used/backpacks",
    browseAllLabel: "View all surfpacks & bags",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "Surfpacks", href: "/used/backpacks?pack=surfpack" },
          { label: "Bags", href: "/used/backpacks?pack=bag" },
        ],
      },
    ],
  },
  {
    id: "collectibles",
    title: "Collectibles & Vintage",
    description:
      "Rare finds and classic surf culture — vintage boards, apparel, art, media, and more.",
    browseAllHref: "/used/collectibles-vintage",
    browseAllLabel: "View all collectibles",
    subcategories: [
      {
        heading: "By type",
        links: [
          { label: "Vintage Surfboards", href: "/used/collectibles-vintage?collectibleType=vintage_surfboards" },
          { label: "Vintage Apparel", href: "/used/collectibles-vintage?collectibleType=vintage_apparel" },
          { label: "Surf Art & Prints", href: "/used/collectibles-vintage?collectibleType=surf_art" },
          { label: "Media & Magazines", href: "/used/collectibles-vintage?collectibleType=media_magazines" },
          { label: "Vintage Gear", href: "/used/collectibles-vintage?collectibleType=vintage_gear" },
          { label: "Rare & Archive", href: "/used/collectibles-vintage?collectibleType=rare_archive" },
        ],
      },
      {
        heading: "By era",
        links: [
          { label: "1970s", href: "/used/collectibles-vintage?collectibleEra=70s" },
          { label: "1980s", href: "/used/collectibles-vintage?collectibleEra=80s" },
          { label: "1990s", href: "/used/collectibles-vintage?collectibleEra=90s" },
          { label: "2000s", href: "/used/collectibles-vintage?collectibleEra=2000s" },
        ],
      },
      {
        heading: "By condition",
        links: [
          { label: "Mint", href: "/used/collectibles-vintage?collectibleCondition=mint" },
          { label: "Good", href: "/used/collectibles-vintage?collectibleCondition=good" },
          { label: "Restored", href: "/used/collectibles-vintage?collectibleCondition=restored" },
          { label: "Display Only", href: "/used/collectibles-vintage?collectibleCondition=display_only" },
        ],
      },
    ],
  },
]
