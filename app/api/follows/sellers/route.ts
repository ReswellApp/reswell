import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/follows/sellers
 * Returns paginated list of sellers the current user follows.
 * Query params: limit (default 20), cursor (created_at of last item for pagination)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const cursor = searchParams.get('cursor') // ISO timestamp

  let query = supabase
    .from('seller_follows')
    .select(`
      id,
      seller_id,
      created_at,
      seller:profiles!seller_follows_seller_id_fkey (
        id,
        display_name,
        shop_name,
        avatar_url,
        shop_logo_url,
        city,
        shop_address,
        follower_count
      )
    `)
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: follows, error } = await query

  if (error) {
    console.error('[follows/sellers] query error:', error)
    return NextResponse.json({ error: 'Failed to load followed sellers.' }, { status: 500 })
  }

  const hasMore = (follows?.length ?? 0) > limit
  const items = (follows ?? []).slice(0, limit)
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

  // For each seller, fetch listing count and last listed date
  const sellerIds = items.map((f) => (f.seller as any)?.id).filter(Boolean)

  const { data: listingStats } = sellerIds.length
    ? await supabase
        .from('listings')
        .select('user_id, created_at')
        .in('user_id', sellerIds)
        .eq('status', 'active')
    : { data: [] }

  const statsByUser: Record<string, { count: number; lastAt: string | null }> = {}
  for (const l of listingStats ?? []) {
    if (!statsByUser[l.user_id]) statsByUser[l.user_id] = { count: 0, lastAt: null }
    statsByUser[l.user_id].count++
    if (!statsByUser[l.user_id].lastAt || l.created_at > statsByUser[l.user_id].lastAt!) {
      statsByUser[l.user_id].lastAt = l.created_at
    }
  }

  const sellers = items.map((f) => {
    const s = f.seller as any
    const stats = statsByUser[s?.id] ?? { count: 0, lastAt: null }
    return {
      id: s?.id,
      display_name: s?.display_name,
      shop_name: s?.shop_name,
      avatar_url: s?.avatar_url,
      shop_logo_url: s?.shop_logo_url,
      city: s?.city,
      shop_address: s?.shop_address,
      follower_count: s?.follower_count ?? 0,
      listing_count: stats.count,
      last_listed_at: stats.lastAt,
      followed_at: f.created_at,
    }
  })

  return NextResponse.json({ sellers, hasMore, nextCursor })
}
