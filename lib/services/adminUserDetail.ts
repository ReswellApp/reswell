import type { User } from "@supabase/supabase-js"
import {
  dbGetAdminUserAuthUser,
  dbGetAdminUserDetailProfile,
  dbListAdminUserDetailListings,
  dbListAdminUserDetailOrders,
  dbListAdminUserTippedSales,
  type AdminUserDetailListingRow,
  type AdminUserDetailOrderRow,
  type AdminUserDetailProfileRow,
} from "@/lib/db/adminUserDetail"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type AdminUserSignupMethod = "google" | "email" | "apple" | "phone" | "other" | "unknown"

export type AdminUserAuthFacts = {
  signupMethod: AdminUserSignupMethod
  signupMethodLabel: string
  providers: string[]
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  authCreatedAt: string | null
  emailConfirmed: boolean
}

export type AdminUserCommerce = {
  listingsTotal: number
  listingsActive: number
  listingsSold: number
  listingsDraft: number
  listingsHidden: number
  listingsRemoved: number
  sellerSales: number
  sellerGms: number
  buyerPurchases: number
  buyerSpend: number
}

export type AdminUserRecentOrder = {
  id: string
  orderNum: string | null
  role: "buyer" | "seller"
  amount: number
  merchandiseAmount: number
  status: string
  createdAt: string
  listingTitle: string | null
}

export type AdminUserDetail = {
  profile: AdminUserDetailProfileRow
  listings: AdminUserDetailListingRow[]
  auth: AdminUserAuthFacts
  commerce: AdminUserCommerce
  recentOrders: AdminUserRecentOrder[]
}

export type {
  AdminUserDetailListingRow,
  AdminUserDetailProfileRow,
}

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

function merchandiseAmount(order: AdminUserDetailOrderRow): number {
  return Math.max(0, order.amount - order.shipping_amount)
}

function signupLabel(method: AdminUserSignupMethod, raw: string): string {
  switch (method) {
    case "google":
      return "Google"
    case "email":
      return "Email & password"
    case "apple":
      return "Apple"
    case "phone":
      return "Phone"
    case "unknown":
      return "Unknown"
    default:
      return raw ? raw.replace(/_/g, " ") : "Other"
  }
}

function resolveSignupMethod(raw: string): AdminUserSignupMethod {
  const key = raw.trim().toLowerCase()
  if (key === "google") return "google"
  if (key === "email") return "email"
  if (key === "apple") return "apple"
  if (key === "phone") return "phone"
  if (!key) return "unknown"
  return "other"
}

export function resolveAdminUserAuthFacts(user: User | null): AdminUserAuthFacts {
  if (!user) {
    return {
      signupMethod: "unknown",
      signupMethodLabel: "Unknown",
      providers: [],
      lastSignInAt: null,
      emailConfirmedAt: null,
      authCreatedAt: null,
      emailConfirmed: false,
    }
  }

  const identities = [...(user.identities ?? [])].sort((a, b) => {
    const aMs = Date.parse(a.created_at ?? "")
    const bMs = Date.parse(b.created_at ?? "")
    const aOk = Number.isFinite(aMs)
    const bOk = Number.isFinite(bMs)
    if (aOk && bOk) return aMs - bMs
    if (aOk) return -1
    if (bOk) return 1
    return 0
  })

  const metadata = user.app_metadata ?? {}
  const metadataProviders = Array.isArray(metadata.providers)
    ? metadata.providers.map((provider) => String(provider))
    : []
  const identityProviders = identities
    .map((identity) => identity.provider)
    .filter((provider): provider is string => Boolean(provider))
  const providers = metadataProviders.length > 0 ? metadataProviders : identityProviders

  const raw =
    identities[0]?.provider ||
    metadataProviders[0] ||
    (typeof metadata.provider === "string" ? metadata.provider : "") ||
    "email"
  const signupMethod = resolveSignupMethod(String(raw))

  return {
    signupMethod,
    signupMethodLabel: signupLabel(signupMethod, String(raw)),
    providers,
    lastSignInAt: user.last_sign_in_at ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    authCreatedAt: user.created_at ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
  }
}

function buildCommerce(
  listings: AdminUserDetailListingRow[],
  orders: AdminUserDetailOrderRow[],
  tippedSales: { listingPriceUsd: number }[],
  userId: string,
): AdminUserCommerce {
  let listingsActive = 0
  let listingsSold = 0
  let listingsDraft = 0
  let listingsHidden = 0
  let listingsRemoved = 0

  for (const listing of listings) {
    if (listing.status === "active") listingsActive += 1
    if (listing.status === "sold") listingsSold += 1
    if (listing.status === "draft") listingsDraft += 1
    if (listing.status === "removed") listingsRemoved += 1
    if (listing.hidden_from_site) listingsHidden += 1
  }

  let sellerSales = 0
  let sellerGms = 0
  let buyerPurchases = 0
  let buyerSpend = 0

  for (const order of orders) {
    if (order.status !== "confirmed") continue
    const gms = merchandiseAmount(order)
    if (order.seller_id === userId) {
      sellerSales += 1
      sellerGms += gms
    }
    if (order.buyer_id === userId) {
      buyerPurchases += 1
      buyerSpend += gms
    }
  }

  for (const tip of tippedSales) {
    sellerSales += 1
    sellerGms += tip.listingPriceUsd
  }

  return {
    listingsTotal: listings.length,
    listingsActive,
    listingsSold,
    listingsDraft,
    listingsHidden,
    listingsRemoved,
    sellerSales,
    sellerGms,
    buyerPurchases,
    buyerSpend,
  }
}

function buildRecentOrders(
  orders: AdminUserDetailOrderRow[],
  userId: string,
): AdminUserRecentOrder[] {
  return orders.slice(0, 8).map((order) => ({
    id: order.id,
    orderNum: order.order_num,
    role: order.seller_id === userId ? "seller" : "buyer",
    amount: order.amount,
    merchandiseAmount: merchandiseAmount(order),
    status: order.status,
    createdAt: order.created_at,
    listingTitle: order.listing_title,
  }))
}

export async function getAdminUserDetail(userId: string): Promise<
  | { ok: true; data: AdminUserDetail }
  | { ok: false; message: string; status: number }
> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const profileResult = await dbGetAdminUserDetailProfile(supabase, userId)
  if (!profileResult.ok) {
    return { ok: false, message: profileResult.message, status: profileResult.status }
  }

  const [listingsResult, authUser, orders, tippedSales] = await Promise.all([
    dbListAdminUserDetailListings(supabase, userId),
    dbGetAdminUserAuthUser(supabase, userId),
    dbListAdminUserDetailOrders(supabase, userId),
    dbListAdminUserTippedSales(supabase, userId),
  ])

  if (!listingsResult.ok) {
    return { ok: false, message: listingsResult.message, status: 500 }
  }

  return {
    ok: true,
    data: {
      profile: profileResult.profile,
      listings: listingsResult.listings,
      auth: resolveAdminUserAuthFacts(authUser),
      commerce: buildCommerce(listingsResult.listings, orders, tippedSales, userId),
      recentOrders: buildRecentOrders(orders, userId),
    },
  }
}
