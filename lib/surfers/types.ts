import type { SurferQuiverItem } from "@/lib/surfers/parse-surfer-quiver-items"

export type { SurferQuiverItem }

export type SurferRow = {
  id: string
  slug: string
  name: string
  short_description: string | null
  instagram_url: string | null
  youtube_url: string | null
  photo_url: string | null
  location_label: string | null
  about_paragraphs: string[]
  /** Profile gallery: surfboard photos with optional title + caption per tile. */
  quiver_items: SurferQuiverItem[]
}
