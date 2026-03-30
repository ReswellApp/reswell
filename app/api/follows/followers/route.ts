import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/follows/followers
 * Seller-only: returns their follower count + basic stats (no personal info).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Follower count from cached column
  const { data: profile } = await supabase
    .from('profiles')
    .select('follower_count')
    .eq('id', user.id)
    .single()

  const followerCount = profile?.follower_count ?? 0

  // New followers this month
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  const { count: newThisMonth } = await supabase
    .from('seller_follows')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', user.id)
    .gte('created_at', monthAgo.toISOString())

  return NextResponse.json({
    followerCount,
    newThisMonth: newThisMonth ?? 0,
  })
}
