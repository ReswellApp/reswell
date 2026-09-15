export type RelatedContentKind = "blog" | "listing"

export type RelatedContentListingSummary = {
  id: string
  slug: string | null
  title: string
  section: string | null
  status: string | null
  hidden_from_site: boolean | null
  primary_image_url: string | null
}

export type RelatedContentBlogSummary = {
  id: string
  slug: string
  title: string
  tag: string
  published: boolean
  listed_on_blog: boolean
  cover_image_url: string | null
}

export type RelatedContentHostSummary = RelatedContentListingSummary & {
  item_count: number
}

export type RelatedContentAdminItem = {
  id: string
  kind: RelatedContentKind
  sort_order: number
  visible_on_pdp: boolean
  blog: RelatedContentBlogSummary | null
  listing: RelatedContentListingSummary | null
}

export type ListingSearchHit = RelatedContentListingSummary & {
  already_curated: boolean
}

export type BlogSearchHit = RelatedContentBlogSummary & {
  already_curated: boolean
}
