export type BrandRow = {
  id: string
  slug: string
  name: string
  short_description: string | null
  website_url: string | null
  logo_url: string | null
  founder_name: string | null
  lead_shaper_name: string | null
  location_label: string | null
  model_count: number
  about_paragraphs: string[]
}
