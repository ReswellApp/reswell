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
  photos: "Photos",
  details: "Condition",
  price: "Price",
  place: "Pickup & shipping",
  review: "Review",
}

export const MAX_SELL_PHOTOS = 8

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

export type SellPhoto = {
  id: string
  uri: string
}

export type SellDraft = {
  photos: SellPhoto[]
  title: string
  brand: string
  model: string
  /** Category slug from `GET /api/mobile/v1/sell/taxonomy`. */
  category: string
  /** Subcategory slug. Board style when the category is surfboards. */
  subcategory: string
  condition: string
  description: string
  price: string
  city: string
  state: string
  localPickup: boolean
  shipping: boolean
}

export function emptySellDraft(): SellDraft {
  return {
    photos: [],
    title: "",
    brand: "",
    model: "",
    category: "",
    subcategory: "",
    condition: "",
    description: "",
    price: "",
    city: "",
    state: "",
    localPickup: true,
    shipping: false,
  }
}

type SellCategoryChoice = {
  slug: string
  subcategories: readonly { slug: string }[]
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

export function stepIsReady(
  step: SellStep,
  draft: SellDraft,
  categories: readonly SellCategoryChoice[] = [],
): boolean {
  if (step === "product") return productStepIsReady(draft, categories)
  if (step === "photos") return draft.photos.length >= 1
  if (step === "details") return draft.condition.length > 0 && draft.description.trim().length > 0
  if (step === "price") {
    const price = priceUsd(draft.price)
    return price >= PRICE_MIN && price <= PRICE_MAX
  }
  if (step === "place") {
    return draft.city.trim().length > 0 && draft.state.trim().length > 0 && (draft.localPickup || draft.shipping)
  }
  return true
}
