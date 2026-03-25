export type DirectoryKind = "brand" | "shaper" | "storefront"

export type BoardModel = {
  slug: string
  name: string
  productUrl: string
  imageUrl: string
  entryRocker: string | null
  exitRocker: string | null
  rockerStyle: string | null
}

/** Rich copy/specs layered on top of {@link BoardModel} when we have scraped or curated data. */
export type BoardModelStockDimRow =
  | { length: string; width: string; thickness: string; volume: string }
  | { raw: string }

export type BoardModelGalleryImage = {
  url: string
  caption: string
}

export type BoardModelDetail = {
  brandSlug: string
  modelSlug: string
  descriptionParagraphs: string[]
  priceUsd: number | null
  marketingImageUrl?: string
  /** When set, shown as a gallery on the model page (e.g. deck, bottom, hero composite). */
  galleryImages?: BoardModelGalleryImage[]
  waveSizeLabels: string[]
  skillLevelLabels: string[]
  stockDims: BoardModelStockDimRow[]
}

export type BrandProfile = {
  slug: string
  kind: "brand"
  name: string
  shortDescription: string
  websiteUrl: string
  logoUrl: string
  founderName: string
  leadShaperName: string
  locationLabel: string
  aboutParagraphs: string[]
  models: BoardModel[]
}

export type DirectoryListEntry = {
  slug: string
  kind: DirectoryKind
  name: string
  shortDescription: string
  logoUrl: string
  locationLabel?: string
  modelCount?: number
}
