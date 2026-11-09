import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

/** Saved address fields the sign-in prompt is allowed to show. Never a guessed street. */
export type SignInShipFromAddress = {
  id: string
  full_name: string
  phone: string | null
  line1: string
  line2: string | null
  city: string
  state: string | null
  postal_code: string
  country: string
  is_default: boolean
}

export type SignInShipFromPersonal = {
  first_name: string | null
  last_name: string | null
  phone: string | null
}

export type SignInShipFromPrefill = {
  full_name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

export type SignInShipFromPromptResult =
  | { shouldPrompt: false }
  | {
      shouldPrompt: true
      needsFullName: boolean
      needsPhone: boolean
      /** Saved `addresses` row to update. Null inserts a new ship-from row. */
      addressId: string | null
      /** True when street, city, or ZIP came from a saved address row. */
      fromSavedAddress: boolean
      title: string
      description: string
      detail: string | null
      prefill: SignInShipFromPrefill
    }

const DISMISS_PREFIX = "reswell-ship-from-prompt-dismissed"

function text(value: string | null | undefined): string {
  return (value ?? "").trim()
}

function preferredAddress<T extends { is_default: boolean }>(addresses: T[]): T | null {
  return addresses.find((row) => row.is_default) ?? addresses[0] ?? null
}

function hasLegalName(personal: SignInShipFromPersonal | null): boolean {
  return Boolean(text(personal?.first_name) && text(personal?.last_name))
}

function legalName(personal: SignInShipFromPersonal | null): string {
  const first = text(personal?.first_name)
  const last = text(personal?.last_name)
  if (!first || !last) return ""
  return `${first} ${last}`
}

/** A saved row can price shipping: real street, city, 2-letter state, and ZIP. */
export function isCompleteSellerShipFrom(addr: {
  line1: string
  city: string
  state: string | null
  postal_code: string
}): boolean {
  const line1 = text(addr.line1)
  const city = text(addr.city)
  const state = normalizeUsStateProvinceForShipping("US", text(addr.state))
  const zip = text(addr.postal_code)
  if (line1.length < 2 || !city || state.length !== 2) return false
  return /^\d{5}(-\d{4})?$/.test(zip)
}

/**
 * Session key for "not now". Includes the auth sign-in time so the next
 * sign-in asks again while a ship-from address is still missing.
 */
export function signInShipFromDismissStorageKey(
  userId: string,
  lastSignInAt: string | null | undefined,
): string {
  const id = text(userId)
  const at = text(lastSignInAt) || "none"
  return `${DISMISS_PREFIX}:${id}:${at}`
}

function localityLabel(city: string, state: string): string | null {
  if (!city) return null
  return state ? `${city}, ${state}` : city
}

/**
 * Prompt a seller who ships (or has sold) and has no complete preferred
 * address. Prefill only from saved address rows and listing city/state.
 * Street is blank unless a saved row already has one.
 */
export function decideSignInShipFromPrompt(input: {
  offersShipping: boolean
  addresses: SignInShipFromAddress[]
  personal: SignInShipFromPersonal | null
  listingCity: string | null
  listingState: string | null
}): SignInShipFromPromptResult {
  if (!input.offersShipping) return { shouldPrompt: false }

  const preferred = preferredAddress(input.addresses)
  if (preferred && isCompleteSellerShipFrom(preferred)) {
    return { shouldPrompt: false }
  }

  const source =
    input.addresses.find((row) => isCompleteSellerShipFrom(row)) ?? preferred

  const savedStreet = text(source?.line1)
  const savedCity = text(source?.city)
  const savedZip = text(source?.postal_code)
  const city = savedCity || text(input.listingCity)
  const state = normalizeUsStateProvinceForShipping(
    "US",
    text(source?.state) || text(input.listingState),
  )
  const fromSavedAddress = Boolean(source && (savedStreet || savedCity || savedZip))
  const place = localityLabel(city, state)

  const title = fromSavedAddress
    ? "Is this where you ship from?"
    : "Where do your packages leave from?"
  const description = fromSavedAddress
    ? "We filled this in from an address already on your account. If packages leave from this door, save it and shipping can be priced."
    : "Shipping needs the real address packages leave from. It takes a minute, and buyers only ever see your city."
  const detail =
    savedStreet || !place
      ? null
      : `Your listings ship from ${place}. Add the street — we won't guess one.`

  return {
    shouldPrompt: true,
    needsFullName: !hasLegalName(input.personal),
    needsPhone: !text(input.personal?.phone),
    addressId: source?.id ?? null,
    fromSavedAddress,
    title,
    description,
    detail,
    prefill: {
      full_name: text(source?.full_name) || legalName(input.personal),
      phone: text(source?.phone) || text(input.personal?.phone),
      line1: savedStreet,
      line2: text(source?.line2),
      city,
      state,
      postal_code: savedZip,
      country: text(source?.country) || "US",
    },
  }
}
