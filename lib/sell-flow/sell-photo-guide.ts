/**
 * Shot checklist under /sell photos. Photos are from
 * `/l/510-tyler-warren-surfboards-quadratic-formula` (Hayden's Quadratic Formula).
 * Card derivatives stay small on the six-up grid.
 */
const LISTING_MEDIA_PREFIX =
  "/media/listings/ab98fbb1-0c49-49e1-9483-a1c4a286c8e2"

export type SellPhotoGuideExample = {
  id: string
  label: string
  /** Same-origin `/media/listings/…-card2.webp` path. */
  path: string
}

export const SELL_PHOTO_GUIDE_EXAMPLES: readonly SellPhotoGuideExample[] = [
  {
    id: "primary",
    label: "Primary",
    path: `${LISTING_MEDIA_PREFIX}/1793147537223-99db0cdc-c68d-44a3-9de4-33a0c0fed05c-card2.webp`,
  },
  {
    id: "bottom",
    label: "Bottom",
    path: `${LISTING_MEDIA_PREFIX}/1793147557461-c89bd6a0-5dd4-4c7f-917e-726fbc497534-card2.webp`,
  },
  {
    id: "rails",
    label: "Rails",
    path: `${LISTING_MEDIA_PREFIX}/1793147536479-630701ee-7f5e-41ff-8f44-e9ff28cc8bdc-card2.webp`,
  },
  {
    id: "tail-fins",
    label: "Tail & fins",
    path: `${LISTING_MEDIA_PREFIX}/1793147580367-f9daf750-fe5c-49e9-bb62-744e96340519-card2.webp`,
  },
  {
    id: "size-scale",
    label: "Size and scale",
    path: `${LISTING_MEDIA_PREFIX}/1793147558963-0705b765-7f4e-4131-9717-b5ef7de1d041-card2.webp`,
  },
  {
    id: "imperfections",
    label: "Imperfections",
    path: `${LISTING_MEDIA_PREFIX}/1793147559496-1555b593-f8b4-432d-a602-fffa239489af-card2.webp`,
  },
]
