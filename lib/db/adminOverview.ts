import type { SupabaseClient } from '@supabase/supabase-js'

import type { ContactMessageSupportStatus } from '@/lib/db/contactMessages'

/** Rolling window for “pulse” metrics on the admin home dashboard. */
export const ADMIN_OVERVIEW_PERIOD_DAYS = 7

function periodSinceIso(): string {
  return new Date(
    Date.now() - ADMIN_OVERVIEW_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
}

function pushUnique(errors: string[], message: string) {
  if (!errors.includes(message)) errors.push(message)
}

export type AdminOverviewListingPreview = {
  id: string
  title: string
  slug: string | null
  price: number
  section: string
  status: string
  created_at: string
  seller_display_name: string | null
}

export type AdminOverviewSupportPreview = {
  id: string
  name: string
  email: string
  subject: string | null
  support_status: ContactMessageSupportStatus
  source: string
  created_at: string
}

export type AdminOverviewUserPreview = {
  id: string
  display_name: string | null
  email: string | null
  created_at: string
}

export type AdminOverviewOrderPreview = {
  id: string
  order_num: string | null
  status: string
  amount: number
  created_at: string
}

export type AdminOverviewBrandRequestPreview = {
  id: string
  requested_name: string
  status: string
  created_at: string
}

export type AdminOverviewSnapshot = {
  periodDays: number
  periodSinceIso: string
  totals: {
    listings: number
    activeListings: number
    users: number
  }
  listingsBySection: { surfboards: number }
  pulse: {
    /** Listings created in the rolling period */
    newListings: number
    /** `profiles` rows created in the rolling period */
    newUsers: number
    /** `contact_messages` rows created in the rolling period */
    newContactThreads: number
    /** Paid marketplace orders created in the rolling period */
    ordersConfirmedInPeriod: number
  }
  attention: {
    /** Inbox rows still marked `new` */
    openSupportTickets: number
    /** Checkout not completed */
    ordersPendingPayment: number
    /** Paid orders awaiting fulfillment completion */
    ordersConfirmedUnfulfilled: number
    /** `brand_requests` still marked pending (aggregated for admins only; others see 0). */
    pendingBrandReviews: number
  }
  previews: {
    recentListings: AdminOverviewListingPreview[]
    recentSupportTickets: AdminOverviewSupportPreview[]
    recentUsers: AdminOverviewUserPreview[]
    recentOrders: AdminOverviewOrderPreview[]
    pendingBrandRequests: AdminOverviewBrandRequestPreview[]
  }
  errors: string[]
}

function listingSellerName(
  profiles: { display_name: string | null } | { display_name: string | null }[] | null,
): string | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0]?.display_name ?? null
  return profiles.display_name ?? null
}

export async function fetchAdminOverviewSnapshot(
  supabase: SupabaseClient,
  options: { includeBrandRequestQueries: boolean },
): Promise<AdminOverviewSnapshot> {
  const errors: string[] = []
  const since = periodSinceIso()

  const [
    listingsTotalRes,
    listingsActiveRes,
    listingsSurfRes,
    usersTotalRes,
    listingsNewPeriodRes,
    usersNewPeriodRes,
    contactThreadsPeriodRes,
    contactOpenRes,
    ordersConfirmedPeriodRes,
    ordersPendingRes,
    ordersConfirmedTotalRes,
    ordersConfirmedFulfilledRes,
    listingsRecentRes,
    supportRecentRes,
    usersRecentRes,
    ordersRecentRes,
    brandPendingCountRes,
    brandRecentRes,
  ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('section', 'surfboards'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('contact_messages').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase
      .from('contact_messages')
      .select('*', { count: 'exact', head: true })
      .eq('support_status', 'new'),
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since)
      .eq('status', 'confirmed'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .in('delivery_status', ['delivered', 'picked_up']),
    supabase
      .from('listings')
      .select(
        'id, title, slug, price, section, status, created_at, profiles!listings_user_id_fkey(display_name)',
      )
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('contact_messages')
      .select('id, name, email, subject, support_status, source, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('profiles')
      .select('id, display_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('orders')
      .select('id, order_num, status, amount, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    options.includeBrandRequestQueries
      ? supabase
          .from('brand_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
      : Promise.resolve({ count: null as number | null, error: null }),
    options.includeBrandRequestQueries
      ? supabase
          .from('brand_requests')
          .select('id, requested_name, status, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
  ])

  const takeCount = (
    res: { count: number | null; error: { message: string } | null },
    label: string,
  ): number => {
    if (res.error) {
      pushUnique(errors, `${label}: ${res.error.message}`)
      return 0
    }
    return res.count ?? 0
  }

  const listingsTotal = takeCount(listingsTotalRes, 'listings total')
  const activeListings = takeCount(listingsActiveRes, 'active listings')
  const surfboards = takeCount(listingsSurfRes, 'listings surfboards')
  const usersTotal = takeCount(usersTotalRes, 'profiles total')
  const newListings = takeCount(listingsNewPeriodRes, 'new listings period')
  const newUsers = takeCount(usersNewPeriodRes, 'new users period')
  const newContactThreads = takeCount(contactThreadsPeriodRes, 'contact messages period')
  const openSupportTickets = takeCount(contactOpenRes, 'open support tickets')
  const ordersConfirmedInPeriod = takeCount(ordersConfirmedPeriodRes, 'orders confirmed period')
  const ordersPendingPayment = takeCount(ordersPendingRes, 'orders pending')
  const confirmedTotal = takeCount(ordersConfirmedTotalRes, 'orders confirmed total')
  const fulfilledSubset = takeCount(ordersConfirmedFulfilledRes, 'orders fulfilled count')

  const ordersConfirmedUnfulfilled = Math.max(0, confirmedTotal - fulfilledSubset)

  const pendingBrandReviews = options.includeBrandRequestQueries
    ? takeCount(
        brandPendingCountRes as { count: number | null; error: { message: string } | null },
        'brand requests pending',
      )
    : 0

  const recentListings: AdminOverviewListingPreview[] = []
  if (listingsRecentRes.error) {
    pushUnique(errors, `recent listings: ${listingsRecentRes.error.message}`)
  } else {
    for (const row of listingsRecentRes.data ?? []) {
      const r = row as Record<string, unknown>
      const profilesRaw = r.profiles as
        | { display_name: string | null }
        | { display_name: string | null }[]
        | null
      recentListings.push({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        slug: r.slug == null ? null : String(r.slug),
        price: Number(r.price ?? 0),
        section: String(r.section ?? ''),
        status: String(r.status ?? ''),
        created_at: String(r.created_at ?? ''),
        seller_display_name: listingSellerName(profilesRaw),
      })
    }
  }

  const recentSupportTickets: AdminOverviewSupportPreview[] = []
  if (supportRecentRes.error) {
    pushUnique(errors, `support preview: ${supportRecentRes.error.message}`)
  } else {
    for (const row of supportRecentRes.data ?? []) {
      const r = row as Record<string, unknown>
      recentSupportTickets.push({
        id: String(r.id ?? ''),
        name: String(r.name ?? ''),
        email: String(r.email ?? ''),
        subject: r.subject == null || r.subject === '' ? null : String(r.subject),
        support_status: (r.support_status as ContactMessageSupportStatus) ?? 'new',
        source: String(r.source ?? 'contact_form'),
        created_at: String(r.created_at ?? ''),
      })
    }
  }

  const recentUsers: AdminOverviewUserPreview[] = []
  if (usersRecentRes.error) {
    pushUnique(errors, `users preview: ${usersRecentRes.error.message}`)
  } else {
    for (const row of usersRecentRes.data ?? []) {
      const r = row as Record<string, unknown>
      recentUsers.push({
        id: String(r.id ?? ''),
        display_name: r.display_name == null ? null : String(r.display_name),
        email: r.email == null ? null : String(r.email),
        created_at: String(r.created_at ?? ''),
      })
    }
  }

  const recentOrders: AdminOverviewOrderPreview[] = []
  if (ordersRecentRes.error) {
    pushUnique(errors, `orders preview: ${ordersRecentRes.error.message}`)
  } else {
    for (const row of ordersRecentRes.data ?? []) {
      const r = row as Record<string, unknown>
      recentOrders.push({
        id: String(r.id ?? ''),
        order_num: r.order_num == null ? null : String(r.order_num),
        status: String(r.status ?? ''),
        amount: Number(r.amount ?? 0),
        created_at: String(r.created_at ?? ''),
      })
    }
  }

  const pendingBrandRequestsPreview: AdminOverviewBrandRequestPreview[] = []
  if (options.includeBrandRequestQueries) {
    const br = brandRecentRes as {
      data: unknown[] | null
      error: { message: string } | null
    }
    if (br.error) {
      pushUnique(errors, `brand requests preview: ${br.error.message}`)
    } else {
      for (const row of br.data ?? []) {
        const r = row as Record<string, unknown>
        pendingBrandRequestsPreview.push({
          id: String(r.id ?? ''),
          requested_name: String(r.requested_name ?? ''),
          status: String(r.status ?? ''),
          created_at: String(r.created_at ?? ''),
        })
      }
    }
  }

  return {
    periodDays: ADMIN_OVERVIEW_PERIOD_DAYS,
    periodSinceIso: since,
    totals: {
      listings: listingsTotal,
      activeListings,
      users: usersTotal,
    },
    listingsBySection: { surfboards },
    pulse: {
      newListings,
      newUsers,
      newContactThreads,
      ordersConfirmedInPeriod,
    },
    attention: {
      openSupportTickets,
      ordersPendingPayment,
      ordersConfirmedUnfulfilled,
      pendingBrandReviews,
    },
    previews: {
      recentListings,
      recentSupportTickets,
      recentUsers,
      recentOrders,
      pendingBrandRequests: pendingBrandRequestsPreview,
    },
    errors,
  }
}
