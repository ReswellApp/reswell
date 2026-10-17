import { surfboardBrowseLinks } from "@/lib/site-category-directory"

/** Public discovery hub. */
export const EXPLORE_PATH = "/explore"

export type ExploreDestination = {
  label: string
  href: string
  description: string
}

/**
 * Starting points on `/explore`. Category routes match the header rail
 * (peer gear that is still hidden from nav stays off this page too).
 */
export const exploreDestinations: readonly ExploreDestination[] = [
  {
    label: "Surfboards",
    href: "/boards",
    description: "Used boards from surfers, filterable by shape, brand, and location.",
  },
  {
    label: "Fins",
    href: "/fins",
    description: "Thrusters, twins, quads, and singles listed by other surfers.",
  },
  {
    label: "Traction",
    href: "/traction",
    description: "Pads and tail kits ready for another board.",
  },
  {
    label: "Wetsuits",
    href: "/wetsuits",
    description: "Used suits by size, thickness, and brand.",
  },
  {
    label: "Apparel",
    href: "/apparel",
    description: "Boardshorts, hats, and tees from the marketplace.",
  },
  {
    label: "Magazines",
    href: "/magazines",
    description: "Surf magazines and back issues from collectors.",
  },
  {
    label: "Brands",
    href: "/brands",
    description: "Shapers and labels in the Reswell catalog.",
  },
  {
    label: "Sellers",
    href: "/sellers",
    description: "Shops and surfers selling gear near you or who ship.",
  },
  {
    label: "Cities",
    href: "/cities/top",
    description: "See where boards and gear are listed right now.",
  },
  {
    label: "Board Finder",
    href: "/board-finder",
    description: "Save a search and get an email when a matching board is listed.",
  },
  {
    label: "Recently sold",
    href: "/sold",
    description: "Boards that just changed hands on Reswell.",
  },
  {
    label: "Price guide",
    href: "/priceguide",
    description: "Typical values, sold comps, and live asking prices.",
  },
]

/** Shape browse links — the Surfboards root stays a destination card. */
export const exploreBoardShapeLinks = surfboardBrowseLinks.filter((link) => link.href !== "/boards")

/** How many city cards to preview before the full directory. */
export const EXPLORE_CITY_PREVIEW_COUNT = 8
