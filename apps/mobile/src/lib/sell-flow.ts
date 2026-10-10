/** Public sell product types. Same sections as the website sell flows. */
export const SELL_SECTIONS = [
  { slug: "surfboards", title: "Surfboard" },
  { slug: "fins", title: "Fins" },
  { slug: "traction", title: "Traction" },
  { slug: "wetsuits", title: "Wetsuits" },
  { slug: "magazines", title: "Magazines" },
  { slug: "apparel", title: "Apparel" },
  { slug: "boardbags", title: "Boardbag" },
  { slug: "surfpacks", title: "Surfpack" },
  { slug: "leashes", title: "Leash" },
  { slug: "accessories", title: "Accessories" },
] as const

export type SellSectionSlug = (typeof SELL_SECTIONS)[number]["slug"]

export type SellSection = (typeof SELL_SECTIONS)[number]

export function sellSectionBySlug(slug: string | undefined): SellSection | null {
  return SELL_SECTIONS.find((section) => section.slug === slug) ?? null
}

export const SELL_CONDITIONS = [
  { value: "brand_new", label: "Brand New" },
  { value: "excellent", label: "Excellent" },
  { value: "very_good", label: "Very Good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
] as const

export const SELL_STEPS = ["photos", "details", "price", "place", "review"] as const

export type SellStep = (typeof SELL_STEPS)[number]

export const SELL_STEP_TITLES: Record<SellStep, string> = {
  photos: "Photos",
  details: "Details",
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
    condition: "",
    description: "",
    price: "",
    city: "",
    state: "",
    localPickup: true,
    shipping: false,
  }
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

export function stepIsReady(step: SellStep, draft: SellDraft): boolean {
  if (step === "photos") return draft.photos.length >= 1
  if (step === "details") return draft.title.trim().length > 0 && draft.condition.length > 0 && draft.description.trim().length > 0
  if (step === "price") {
    const price = priceUsd(draft.price)
    return price >= PRICE_MIN && price <= PRICE_MAX
  }
  if (step === "place") {
    return draft.city.trim().length > 0 && draft.state.trim().length > 0 && (draft.localPickup || draft.shipping)
  }
  return true
}
