import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/following/feed
 * Cursor-based paginated feed of listings from followed sellers.
 * Query params: cursor (ISO timestamp), limit (default 20)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const cursor = searchParams.get('cursor')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch followed seller IDs first (Supabase JS doesn't support subqueries in .in())
  const { data: followedSellers } = await supabase
    .from('seller_follows')
    .select('seller_id')
    .eq('follower_id', user.id)

  const sellerIds = (followedSellers ?? []).map((f) => f.seller_id)

  if (sellerIds.length === 0) {
    return NextResponse.json({ listings: [], hasMore: false, nextCursor: null })
  }

  let query = supabase
    .from('listings')
    .select(`
      id,
      title,
      price,
      slug,
      section,
      created_at,
      city,
      state,
      listing_images (url, is_primary),
      seller:profiles!listings_user_id_fkey (
        id,
        display_name,
        shop_name,
        avatar_url,
        city
      )
    `)
    .in('user_id', sellerIds)
    .eq('status', 'active')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: listings, error } = await query

  if (error) {
    console.error('[following/feed] error:', error)
    return NextResponse.json({ error: 'Failed to load feed.' }, { status: 500 })
  }

  const hasMore = (listings?.length ?? 0) > limit
  const items = (listings ?? []).slice(0, limit)
  const nextCursor = hasMore ? items[items.length - 1]?.created_at ?? null : null

  return NextResponse.json({ listings: items, hasMore, nextCursor })
}
