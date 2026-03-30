import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET /api/follows/status?sellerId=xxx */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sellerId = req.nextUrl.searchParams.get('sellerId')

  if (!sellerId) {
    return NextResponse.json({ error: 'Missing sellerId.' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('follower_count')
    .eq('id', sellerId)
    .single()

  const followerCount = profile?.follower_count ?? 0

  if (!user) {
    return NextResponse.json({ following: false, followerCount })
  }

  const { data: follow } = await supabase
    .from('seller_follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('seller_id', sellerId)
    .maybeSingle()

  return NextResponse.json({ following: !!follow, followerCount })
}
