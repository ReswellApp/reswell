import type { MobileListingDetail, MobileListingRails } from "@reswell/api-contract"

/** Same window as Redis listing PDP so revisits skip the spinner without going stale. */
const FRESH_MS = 45_000
const MAX_SLOTS = 24

type Slot<T> = { at: number; value: T }

const listingSlots = new Map<string, Slot<MobileListingDetail>>()
const railsSlots = new Map<string, Slot<MobileListingRails>>()
const listingLoads = new Map<string, Promise<MobileListingDetail>>()
const railsLoads = new Map<string, Promise<MobileListingRails>>()

function normalizeParam(param: string): string {
  return param.trim().toLowerCase()
}

function scope(accessToken?: string | null): string {
  return accessToken ? accessToken.slice(-12) : "anon"
}

function slotKey(param: string, accessToken?: string | null): string {
  return `${normalizeParam(param)}:${scope(accessToken)}`
}

function setSlot<T>(map: Map<string, Slot<T>>, key: string, value: T): void {
  map.delete(key)
  map.set(key, { at: Date.now(), value })
  while (map.size > MAX_SLOTS) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

function readFresh<T>(map: Map<string, Slot<T>>, key: string): T | undefined {
  const slot = map.get(key)
  if (!slot) return undefined
  if (Date.now() - slot.at >= FRESH_MS) return undefined
  return slot.value
}

export function listingMatchesParam(listing: MobileListingDetail, param: string): boolean {
  const key = normalizeParam(param)
  if (!key) return false
  return listing.id.toLowerCase() === key || listing.slug?.toLowerCase() === key
}

function listingAliasParams(listing: MobileListingDetail): string[] {
  const aliases = [listing.id]
  if (listing.slug && normalizeParam(listing.slug) !== listing.id.toLowerCase()) {
    aliases.push(listing.slug)
  }
  return aliases
}

/** Instant read for the listing screen. Stale values are OK — the fetch still refreshes. */
export function peekCachedListing(param: string, accessToken?: string | null): MobileListingDetail | null {
  if (!param.trim()) return null
  return listingSlots.get(slotKey(param, accessToken))?.value ?? null
}

export function peekCachedRails(param: string, accessToken?: string | null): MobileListingRails | null {
  if (!param.trim()) return null
  return railsSlots.get(slotKey(param, accessToken))?.value ?? null
}

export function rememberCachedListing(listing: MobileListingDetail, accessToken?: string | null): void {
  for (const param of listingAliasParams(listing)) {
    setSlot(listingSlots, slotKey(param, accessToken), listing)
  }
}

export function rememberCachedRails(
  param: string,
  value: MobileListingRails,
  accessToken?: string | null,
  listing?: MobileListingDetail | null,
): void {
  const aliases = listing ? listingAliasParams(listing) : []
  if (!aliases.some((alias) => normalizeParam(alias) === normalizeParam(param))) {
    aliases.unshift(param)
  }
  for (const alias of aliases) {
    setSlot(railsSlots, slotKey(alias, accessToken), value)
  }
}

export function forgetCachedListing(listingId: string): void {
  const match = normalizeParam(listingId)
  if (!match) return
  const keys = new Set<string>()
  for (const [key, slot] of listingSlots) {
    if (listingMatchesParam(slot.value, match)) keys.add(key)
  }
  for (const map of [listingSlots, railsSlots, listingLoads, railsLoads]) {
    for (const key of map.keys()) {
      if (key.startsWith(`${match}:`)) keys.add(key)
    }
  }
  for (const key of keys) {
    listingSlots.delete(key)
    railsSlots.delete(key)
    listingLoads.delete(key)
    railsLoads.delete(key)
  }
}

export function clearListingPdpCache(): void {
  listingSlots.clear()
  railsSlots.clear()
  listingLoads.clear()
  railsLoads.clear()
}

function loadCached<T>(
  loads: Map<string, Promise<T>>,
  slots: Map<string, Slot<T>>,
  key: string,
  loader: () => Promise<T>,
  remember: (value: T) => void,
  force: boolean,
): Promise<T> {
  if (!force) {
    const pending = loads.get(key)
    if (pending) return pending
    const fresh = readFresh(slots, key)
    if (fresh !== undefined) return Promise.resolve(fresh)
  }

  let load: Promise<T>
  load = loader()
    .then((value) => {
      remember(value)
      return value
    })
    .catch((error: unknown) => {
      if (loads.get(key) === load) loads.delete(key)
      throw error
    })
  loads.set(key, load)
  void load.then(
    () => {
      if (loads.get(key) === load) loads.delete(key)
    },
    () => undefined,
  )
  return load
}

export function loadCachedListing(
  param: string,
  accessToken: string | null | undefined,
  loader: () => Promise<MobileListingDetail>,
  options?: { force?: boolean },
): Promise<MobileListingDetail> {
  return loadCached(
    listingLoads,
    listingSlots,
    slotKey(param, accessToken),
    loader,
    (listing) => rememberCachedListing(listing, accessToken),
    Boolean(options?.force),
  )
}

export function loadCachedRails(
  param: string,
  accessToken: string | null | undefined,
  loader: () => Promise<MobileListingRails>,
  options?: { force?: boolean },
): Promise<MobileListingRails> {
  return loadCached(
    railsLoads,
    railsSlots,
    slotKey(param, accessToken),
    loader,
    (value) => rememberCachedRails(param, value, accessToken, peekCachedListing(param, accessToken)),
    Boolean(options?.force),
  )
}
