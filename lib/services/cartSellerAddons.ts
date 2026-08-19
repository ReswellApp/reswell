import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CART_SELLER_ADDON_SECTIONS,
  fetchCartHostFinSystems,
  fetchCartSellerAddonListings,
  type CartSellerAddonRow,
  type CartSellerAddonSection,
} from "@/lib/db/cart-seller-addons"
import { sellerProfileHref } from "@/lib/seller-slug"
import { isPeerListingSection } from "@/lib/peer-listing-sections"

const SECTION_RANK: Record<CartSellerAddonSection, number> = {
  fins: 0,
  leashes: 1,
  accessories: 2,
  boardbags: 3,
}

const PER_SELLER_LIMIT = 6
const MAX_TOTAL = 18

export type CartSellerAddonHost = {
  listingId: string
  sellerId: string
  title: string
  section: string
  sellerName: string
  sellerSlug: string | null
}

export type CartSellerAddonCarouselItem = CartSellerAddonRow & {
  sellerName: string
  sellerSlug: string | null
  pairsWithTitle: string
  pairsWithLabel: string
  compatibleFinSystem: boolean
}

export type CartSellerAddonsResult = {
  listings: CartSellerAddonCarouselItem[]
  viewAllHref: string | null
  viewAllLabel: string
  subtitle: string
}

function truncateTitle(title: string, max = 28): string {
  const t = title.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function addonSectionRank(section: string): number {
  if (section in SECTION_RANK) {
    return SECTION_RANK[section as CartSellerAddonSection]
  }
  return CART_SELLER_ADDON_SECTIONS.length
}

function isAddonSection(section: string): section is CartSellerAddonSection {
  return (CART_SELLER_ADDON_SECTIONS as readonly string[]).includes(section)
}

type HostWithSystem = CartSellerAddonHost & { finSystem: string | null }

function pickPairingHost(
  addon: CartSellerAddonRow,
  sellerHosts: HostWithSystem[],
): { host: HostWithSystem; compatibleCount: number } | null {
  if (sellerHosts.length === 0) return null

  const boards = sellerHosts.filter((h) => h.section === "surfboards")
  const pool = boards.length > 0 ? boards : sellerHosts

  if (addon.section === "fins") {
    const system = addon.fin_system?.trim().toLowerCase() ?? ""
    if (system) {
      const compatible = pool.filter((h) => (h.finSystem ?? "").trim().toLowerCase() === system)
      if (compatible[0]) {
        return { host: compatible[0], compatibleCount: compatible.length }
      }
    }
  }

  return { host: pool[0]!, compatibleCount: 0 }
}

function pairingLabel(input: {
  addon: CartSellerAddonRow
  host: HostWithSystem
  sellerHostCount: number
  sellerCount: number
  compatibleCount: number
}): string {
  const board = truncateTitle(input.host.title)
  const seller = input.host.sellerName
  const showSeller = input.sellerCount > 1

  if (input.compatibleCount > 0 && input.addon.section === "fins") {
    if (input.compatibleCount > 1) {
      return showSeller ? `Fits ${seller}'s boards` : `Fits your boards from ${seller}`
    }
    return showSeller ? `Fits ${seller} · ${board}` : `Fits your ${board}`
  }

  if (input.sellerHostCount > 1) {
    return showSeller ? `With ${seller}` : `With your boards from ${seller}`
  }

  return showSeller ? `With ${seller} · ${board}` : `With your ${board}`
}

function interleaveBySeller(groups: CartSellerAddonCarouselItem[][]): CartSellerAddonCarouselItem[] {
  const out: CartSellerAddonCarouselItem[] = []
  let index = 0
  let progressed = true
  while (progressed && out.length < MAX_TOTAL) {
    progressed = false
    for (const group of groups) {
      const next = group[index]
      if (!next) continue
      out.push(next)
      progressed = true
      if (out.length >= MAX_TOTAL) break
    }
    index += 1
  }
  return out
}

function browseHrefForSections(sections: string[]): string {
  if (sections.every((s) => s === "fins")) return "/fins"
  if (sections.every((s) => s === "leashes")) return "/leashes"
  if (sections.every((s) => s === "accessories")) return "/accessories"
  if (sections.every((s) => s === "boardbags")) return "/boardbags"
  if (sections.includes("fins")) return "/fins"
  return "/boards"
}

function buildSubtitle(listings: CartSellerAddonCarouselItem[], hosts: CartSellerAddonHost[]): string {
  const sellerIds = [...new Set(listings.map((l) => l.user_id))]
  const allFins = listings.length > 0 && listings.every((l) => l.section === "fins")
  const noun = allFins ? "Fins" : "Add-ons"

  if (sellerIds.length === 1) {
    const sellerName = listings[0]?.sellerName ?? "this seller"
    const sellerHosts = hosts.filter((h) => h.sellerId === sellerIds[0])
    const boardHosts = sellerHosts.filter((h) => h.section === "surfboards")
    const named = boardHosts.length === 1 ? boardHosts[0] : sellerHosts.length === 1 ? sellerHosts[0] : null
    if (named) {
      return `${noun} from ${sellerName} — add them and ship with your ${truncateTitle(named.title, 36)}`
    }
    return `${noun} from ${sellerName} — checkout and ship together`
  }

  return `${noun} from sellers in your cart — checkout and ship with each board`
}

/**
 * Same-seller add-ons for the cart upsell row. Prefer fins that match a
 * board's fin system; otherwise pair each listing with that seller's board.
 */
export async function getCartSellerAddons(
  supabase: SupabaseClient,
  hosts: CartSellerAddonHost[],
  excludeListingIds: string[],
): Promise<CartSellerAddonsResult> {
  const empty: CartSellerAddonsResult = {
    listings: [],
    viewAllHref: null,
    viewAllLabel: "View all",
    subtitle: "",
  }

  const eligibleHosts = hosts.filter(
    (h) => h.sellerId && isPeerListingSection(h.section) && !isAddonSection(h.section),
  )
  if (eligibleHosts.length === 0) {
    return empty
  }

  const sellerIds = [...new Set(eligibleHosts.map((h) => h.sellerId))]
  const hostIds = [...new Set(eligibleHosts.map((h) => h.listingId))]

  const [addonResult, hostSystems] = await Promise.all([
    fetchCartSellerAddonListings(supabase, sellerIds, {
      excludeListingIds,
      limit: 48,
    }),
    fetchCartHostFinSystems(supabase, hostIds),
  ])

  if (addonResult.error) {
    console.error("[cartSellerAddons] addon query failed", {
      error: addonResult.error,
      sellerCount: sellerIds.length,
      timestamp: new Date().toISOString(),
    })
    return empty
  }
  if (hostSystems.error) {
    console.error("[cartSellerAddons] host fin_system query failed", {
      error: hostSystems.error,
      hostCount: hostIds.length,
      timestamp: new Date().toISOString(),
    })
  }

  const finSystemByHostId = new Map(hostSystems.rows.map((row) => [row.id, row.fin_system]))
  const hostsWithSystem: HostWithSystem[] = eligibleHosts.map((h) => ({
    ...h,
    finSystem: finSystemByHostId.get(h.listingId) ?? null,
  }))

  const hostsBySeller = new Map<string, HostWithSystem[]>()
  for (const host of hostsWithSystem) {
    const list = hostsBySeller.get(host.sellerId) ?? []
    list.push(host)
    hostsBySeller.set(host.sellerId, list)
  }

  const grouped = new Map<string, CartSellerAddonCarouselItem[]>()

  for (const addon of addonResult.listings) {
    const sellerHosts = hostsBySeller.get(addon.user_id) ?? []
    const paired = pickPairingHost(addon, sellerHosts)
    if (!paired) continue

    const sellerName = paired.host.sellerName
    const item: CartSellerAddonCarouselItem = {
      ...addon,
      sellerName,
      sellerSlug: paired.host.sellerSlug,
      pairsWithTitle: paired.host.title,
      pairsWithLabel: pairingLabel({
        addon,
        host: paired.host,
        sellerHostCount: sellerHosts.length,
        sellerCount: sellerIds.length,
        compatibleCount: paired.compatibleCount,
      }),
      compatibleFinSystem: paired.compatibleCount > 0,
    }

    const bucket = grouped.get(addon.user_id) ?? []
    bucket.push(item)
    grouped.set(addon.user_id, bucket)
  }

  const sortedGroups: CartSellerAddonCarouselItem[][] = []
  for (const sellerId of sellerIds) {
    const items = grouped.get(sellerId)
    if (!items || items.length === 0) continue
    items.sort((a, b) => {
      if (a.compatibleFinSystem !== b.compatibleFinSystem) {
        return a.compatibleFinSystem ? -1 : 1
      }
      const rank = addonSectionRank(a.section) - addonSectionRank(b.section)
      if (rank !== 0) return rank
      return a.title.localeCompare(b.title)
    })
    sortedGroups.push(items.slice(0, PER_SELLER_LIMIT))
  }

  const listings = interleaveBySeller(sortedGroups)
  if (listings.length === 0) {
    return empty
  }

  const uniqueSellers = [...new Set(listings.map((l) => l.user_id))]
  const first = listings[0]!
  const shopHref = first.sellerSlug ? sellerProfileHref({ seller_slug: first.sellerSlug }) : null
  const useShopLink = uniqueSellers.length === 1 && Boolean(shopHref)

  return {
    listings,
    viewAllHref: useShopLink ? shopHref : browseHrefForSections(listings.map((l) => l.section)),
    viewAllLabel: useShopLink ? "View shop" : "View all",
    subtitle: buildSubtitle(listings, eligibleHosts),
  }
}
