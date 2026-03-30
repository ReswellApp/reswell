import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/follows/notifications
 * Returns unread follow notifications for the current user.
 * Query params: limit (default 20), unreadOnly (default true)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 50)
  const unreadOnly = searchParams.get('unreadOnly') !== 'false'

  let query = supabase
    .from('notifications')
    .select(`
      id,
      type,
      listing_id,
      actor_id,
      message,
      is_read,
      created_at,
      actor:profiles!notifications_actor_id_fkey (
        id,
        display_name,
        shop_name,
        avatar_url,
        city
      ),
      listing:listings!notifications_listing_id_fkey (
        id,
        title,
        price,
        slug,
        section,
        listing_images (url, is_primary)
      )
    `)
    .eq('user_id', user.id)
    .in('type', ['new_listing_from_followed', 'price_drop_from_followed'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.eq('is_read', false)
  }

  const { data: notifications, error } = await query

  if (error) {
    console.error('[follow notifications] query error:', error)
    return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500 })
  }

  // Unread count (always returned regardless of filter)
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('type', ['new_listing_from_followed', 'price_drop_from_followed'])
    .eq('is_read', false)

  return NextResponse.json({ notifications: notifications ?? [], unreadCount: unreadCount ?? 0 })
}

/**
 * PATCH /api/follows/notifications
 * Mark follow notifications as read.
 * Body: { ids?: string[] } — if omitted, marks ALL follow notifications as read.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { ids } = body as { ids?: string[] }

  let query = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .in('type', ['new_listing_from_followed', 'price_drop_from_followed'])

  if (ids && ids.length > 0) {
    query = query.in('id', ids)
  }

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to mark as read.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
