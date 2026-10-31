import type { MobileSellBoardSpecs, MobileSellFulfillment } from "@reswell/api-contract"

export const SELL_CONDITIONS = [
  { value: "brand_new", label: "Brand New" },
  { value: "excellent", label: "Excellent" },
  { value: "very_good", label: "Very Good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
] as const

export const SELL_STEPS = ["product", "photos", "details", "price", "place", "review"] as const

export type SellStep = (typeof SELL_STEPS)[number]

export const SELL_STEP_TITLES: Record<SellStep, string> = {
  product: "Product info",
  photos: "Photos & video",
  details: "Condition",
  price: "Price",
  place: "Shipping",
  review: "Review",
}

/** Same cap as website sell / `MOBILE_SELL_MAX_PHOTOS`. */
export const MAX_SELL_PHOTOS = 12

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

export const SELL_SHIPPING_MODES = ["reswell", "free", "flat"] as const
export type SellShippingMode = (typeof SELL_SHIPPING_MODES)[number]

export type SellPhoto = {
  id: string
  uri: string
  /** Public listing-photo URLs after a successful upload. */
  url?: string
  thumbnailUrl?: string
  /** Existing `listing_images.id` when editing a published listing. */
  serverImageId?: string
}

export type SellVideoStatus = "idle" | "uploading" | "ready" | "error"

/** Optional one-clip listing video. Same 6s–2min / 200MB rules as website sell. */
export type SellVideo = {
  id: string
  uri: string
  url?: string
  thumbnailUrl?: string | null
  thumbnailUri?: string | null
  contentType?: string | null
  durationSeconds?: number | null
  byteSize?: number | null
  /** Existing `listing_videos.id` when editing. */
  serverVideoId?: string
  status?: SellVideoStatus
  uploadProgress?: number | null
  errorMessage?: string | null
}

export type SellDraft = {
  photos: SellPhoto[]
  video: SellVideo | null
  title: string
  brand: string
  model: string
  /**
   * Directory brand id from catalog suggest / brand-models. Empty when the seller
   * free-typed a brand (same idea as website `boardBrandId`).
   */
  brandId: string
  /** Catalog `brand_models.id` when a model row was picked. Empty for free-typed model. */
  brandModelId: string
  /** Brand name locked when `brandId` was set — typing away from it clears the link. */
  linkedBrandName: string
  /** Category slug from `GET /api/mobile/v1/sell/taxonomy`. */
  category: string
  /** Subcategory slug. Board style when the category is surfboards. */
  subcategory: string
  condition: string
  description: string
  price: string
  /** Display label from the place dropdown. */
  locationLabel: string
  city: string
  state: string
  locationLat: number | null
  locationLng: number | null
  localPickup: boolean
  shipping: boolean
  shippingMode: SellShippingMode
  shippingPrice: string
  packageLength: string
  packageWidth: string
  packageHeight: string
  packageWeightLb: string
  packageWeightOz: string
  dropoffLocationId: string
  /** Website draft id. Empty until Draft saves to the account. */
  serverDraftId: string
  /** Values for API-defined board spec fields. Keys are field ids from board specs. */
  specs: Record<string, string>
}

export const SURFBOARDS_CATEGORY_SLUG = "surfboards"

/** Surfboards default to local pickup only; every other category defaults to shipping only. */
export function defaultDeliveryForCategory(category: string): Pick<SellDraft, "shipping" | "localPickup"> {
  if (category === SURFBOARDS_CATEGORY_SLUG) {
    return { shipping: false, localPickup: true }
  }
  return { shipping: true, localPickup: false }
}

export function emptySellDraft(): SellDraft {
  return {
    photos: [],
    video: null,
    title: "",
    brand: "",
    model: "",
    brandId: "",
    brandModelId: "",
    linkedBrandName: "",
    category: "",
    subcategory: "",
    condition: "",
    description: "",
    price: "",
    locationLabel: "",
    city: "",
    state: "",
    locationLat: null,
    locationLng: null,
    localPickup: false,
    shipping: true,
    shippingMode: "reswell",
    shippingPrice: "",
    packageLength: "",
    packageWidth: "",
    packageHeight: "",
    packageWeightLb: "",
    packageWeightOz: "",
    dropoffLocationId: "",
    serverDraftId: "",
    specs: {},
  }
}

type SellCategoryChoice = {
  slug: string
  subcategories: readonly { slug: string }[]
  fulfillment?: MobileSellFulfillment
  board_specs?: boolean
}

/** Product info is ready when title, brand, model, and category are set, plus a subcategory when the API requires one. */
export function productStepIsReady(draft: SellDraft, categories: readonly SellCategoryChoice[]): boolean {
  if (!draft.title.trim() || !draft.brand.trim() || !draft.model.trim() || !draft.category) return false
  const category = categories.find((item) => item.slug === draft.category)
  if (!category) return false
  if (category.subcategories.length === 0) return true
  return category.subcategories.some((item) => item.slug === draft.subcategory)
}

export function sellConditionLabel(value: string): string {
  return SELL_CONDITIONS.find((option) => option.value === value)?.label ?? value
}

export function sanitizePriceInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "")
  const [whole, ...rest] = cleaned.split(".")
  if (rest.length === 0) return whole ?? ""
  return `${whole}.${rest.join("").slice(0, 2)}`
}

export function priceUsd(raw: string): number {
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

export function formatSellPrice(raw: string): string {
  return priceUsd(raw).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

/** Every section of the one-screen listing form, except the unused review step. */
export function sellDraftIsReady(
  draft: SellDraft,
  categories: readonly SellCategoryChoice[] = [],
  boardSpecs: MobileSellBoardSpecs | null = null,
): boolean {
  return SELL_STEPS.every((step) => step === "review" || stepIsReady(step, draft, categories, boardSpecs))
}

export function stepIsReady(
  step: SellStep,
  draft: SellDraft,
  categories: readonly SellCategoryChoice[] = [],
  boardSpecs: MobileSellBoardSpecs | null = null,
): boolean {
  if (step === "product") return productStepIsReady(draft, categories)
  if (step === "photos") {
    const category = categories.find((item) => item.slug === draft.category)
    return photosStepIsReady(draft, category?.board_specs === true, boardSpecs)
  }
  if (step === "details") return draft.condition.length > 0 && draft.description.trim().length > 0
  if (step === "price") {
    const price = priceUsd(draft.price)
    return price >= PRICE_MIN && price <= PRICE_MAX
  }
  if (step === "place") {
    const category = categories.find((item) => item.slug === draft.category)
    return placeStepIsReady(draft, category?.fulfillment)
  }
  return true
}

/** Photos are required. Required board-spec fields come from the board specs API. */
export function photosStepIsReady(
  draft: SellDraft,
  needsBoardSpecs: boolean,
  boardSpecs: MobileSellBoardSpecs | null,
): boolean {
  if (draft.photos.length < 1) return false
  if (!needsBoardSpecs) return true
  if (!boardSpecs) return false
  return boardSpecs.sections.every((section) =>
    section.fields.every((field) => !field.required || boardSpecValue(draft, field.id).trim().length > 0),
  )
}

export function boardSpecValue(draft: SellDraft, fieldId: string): string {
  return draft.specs[fieldId] ?? ""
}

/** Filled board-spec rows for review. Labels and option text come from the board specs API. */
export function boardSpecReviewLines(
  draft: SellDraft,
  specs: MobileSellBoardSpecs | null,
): { label: string; value: string }[] {
  if (!specs) return []
  const lines: { label: string; value: string }[] = []
  for (const section of specs.sections) {
    for (const field of section.fields) {
      const raw = boardSpecValue(draft, field.id).trim()
      if (!raw) continue
      const option = field.options.find((item) => item.value === raw)
      const value = option?.label ?? raw
      lines.push({ label: field.label, value: field.suffix ? `${value} ${field.suffix}` : value })
    }
  }
  return lines
}

function positiveInches(raw: string): boolean {
  const value = Number(raw.trim())
  return Number.isFinite(value) && value > 0
}

function packageIsReady(draft: SellDraft): boolean {
  if (!positiveInches(draft.packageLength) || !positiveInches(draft.packageWidth) || !positiveInches(draft.packageHeight)) {
    return false
  }
  const pounds = draft.packageWeightLb.trim() === "" ? 0 : Number(draft.packageWeightLb)
  const ounces = draft.packageWeightOz.trim() === "" ? 0 : Number(draft.packageWeightOz)
  if (!Number.isFinite(pounds) || pounds < 0 || !Number.isFinite(ounces) || ounces < 0 || ounces >= 16) return false
  if (draft.packageWeightLb.trim() === "" && draft.packageWeightOz.trim() === "") return false
  return pounds * 16 + ounces > 0
}

/** Place step matches the category's website shipping section. */
export function placeStepIsReady(draft: SellDraft, fulfillment: MobileSellFulfillment | undefined): boolean {
  if (!fulfillment) return false
  // City/state are required. Coords are optional so legacy listings (city/state only) stay editable.
  if (!draft.city.trim() || !draft.state.trim()) return false

  const shippingOn = fulfillment.shipping_toggle ? draft.shipping : true
  const pickupOn = fulfillment.local_pickup ? draft.localPickup : false
  if (!shippingOn && !pickupOn) return false
  if (!shippingOn) return true

  const selected =
    fulfillment.shipping_options.find((option) => option.id === draft.shippingMode)?.id ??
    fulfillment.shipping_options[0]?.id ??
    "reswell"
  if (selected === "flat") {
    const price = Number(draft.shippingPrice)
    if (draft.shippingPrice.trim() === "" || !Number.isFinite(price) || price < 0) return false
  }
  if (selected === "reswell" && fulfillment.package_dimensions && !packageIsReady(draft)) return false
  return true
}

const SHIPPING_SUMMARY: Record<SellShippingMode, string> = {
  reswell: "Reswell shipping",
  free: "Free shipping",
  flat: "Flat-rate shipping",
}

export function sellFulfillmentSummary(draft: SellDraft, fulfillment: MobileSellFulfillment | undefined): string {
  const shippingOn = fulfillment ? (fulfillment.shipping_toggle ? draft.shipping : true) : draft.shipping
  const pickupOn = fulfillment?.local_pickup ? draft.localPickup : false
  const mode = fulfillment?.shipping_options.find((option) => option.id === draft.shippingMode)?.id
  const shippingLabel = !shippingOn
    ? null
    : mode
      ? SHIPPING_SUMMARY[mode]
      : fulfillment && fulfillment.shipping_options.length === 0
        ? "Reswell shipping"
        : "Shipping"
  return [shippingLabel, pickupOn ? "Local pickup" : null].filter((item): item is string => item != null).join(" · ")
}
