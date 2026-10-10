export type SurfboardBoxSource = {
  id: string
  name: string
  fit: string
  summary: string
  details: readonly string[]
  href?: string
  cta?: string
}

/**
 * Where sellers can get a surfboard carton.
 * A New Earth Project is the Reswell partner. Uline S-14259 is their catalog
 * surfboard carton (24×8×57–108"). BOX Partners stocks the same telescopic pair.
 */
export const SURFBOARD_BOX_SOURCES: readonly SurfboardBoxSource[] = [
  {
    id: "anep",
    name: "A New Earth Project",
    fit: "Best for shops and regular shippers",
    summary:
      "Reswell’s board-box partner. The S3 system is built for surfboards and is curbside recyclable.",
    details: [
      "S3 Pro is a telescoping corrugated set, fiber SUS-RAP wrap, and reusable silicone bands. You pad the board without foam sheets or plastic film.",
      "A complete S3 Pro set includes 30 telescoping box sets. Pricing is on request, so it fits a shop better than a one-time sale.",
      "S3 Multi uses the same recyclable materials to pack more than one board in a single carton.",
    ],
    href: "https://anewearthproject.com/collections/surfboard-packaging",
    cta: "See surfboard packaging",
  },
  {
    id: "uline",
    name: "Uline",
    fit: "Easiest catalog order",
    summary:
      "Uline stocks a two-piece telescopic carton made for surfboards, model S-14259.",
    details: [
      "Inside size is 24 × 8 inches, and the length slides from 57 to 108 inches. It is 275 lb double-wall corrugated with full-overlap flaps.",
      "It ships by motor freight, so plan on a freight delivery. Order it when you need several cartons, not for a single board.",
      "The 8-inch depth is past the 6-inch height where Reswell labels jump. A board packed in this carton usually misses the cheaper rate band. Check the shipping estimator before you buy a case.",
    ],
    href: "https://www.uline.com/Product/Detail/S-14259/Corrugated-Boxes-200-Test/24-x-8-x-57-108-275-lb-Double-Wall-2-piece-Telescopic-Tall-Boxes",
    cta: "View S-14259 on Uline",
  },
  {
    id: "shop",
    name: "A local surf shop",
    fit: "Best for one board",
    summary:
      "New boards arrive in cartons. Shops often have a spare they will sell or give away.",
    details: [
      "Ask before you order a case. A used carton is fine when the walls are still stiff and the flaps still meet.",
      "The box the board came in is the other free option, if you kept it and it still closes square.",
    ],
  },
] as const

export const SURFBOARD_BOX_WHOLESALER = {
  name: "BOX Partners",
  href: "https://www.boxpartners.com/Shop/C153.aspx",
  note: "stocks the same style of telescopic carton: a 24 × 8 × 57 inch inner and a slightly larger outer, sold separately, with the length sliding out to 108 inches. It has the same height limit as the Uline surfboard carton.",
} as const
