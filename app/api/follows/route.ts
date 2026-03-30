import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** POST /api/follows — follow a seller */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to follow sellers.' }, { status: 401 })
  }

  const body = await req.json()
  const { sellerId } = body as { sellerId: string }

  if (!sellerId) {
    return NextResponse.json({ error: 'Missing sellerId.' }, { status: 400 })
  }

  if (user.id === sellerId) {
    return NextResponse.json({ error: "You can't follow yourself." }, { status: 400 })
  }

  // Verify the seller profile exists
  const { data: seller, error: sellerErr } = await supabase
    .from('profiles')
    .select('id, follower_count')
    .eq('id', sellerId)
    .single()

  if (sellerErr || !seller) {
    return NextResponse.json({ error: 'Seller not found.' }, { status: 404 })
  }

  // Upsert — idempotent, safe to call multiple times
  const { error } = await supabase
    .from('seller_follows')
    .upsert(
      { follower_id: user.id, seller_id: sellerId },
      { onConflict: 'follower_id,seller_id', ignoreDuplicates: true }
    )

  if (error) {
    console.error('[follows] insert error:', error)
    return NextResponse.json({ error: 'Failed to follow seller.' }, { status: 500 })
  }

  // Re-read the (trigger-updated) follower count
  const { data: updated } = await supabase
    .from('profiles')
    .select('follower_count')
    .eq('id', sellerId)
    .single()

  return NextResponse.json({ following: true, followerCount: updated?.follower_count ?? 0 })
}

/** DELETE /api/follows — unfollow a seller */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await req.json()
  const { sellerId } = body as { sellerId: string }

  if (!sellerId) {
    return NextResponse.json({ error: 'Missing sellerId.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('seller_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('seller_id', sellerId)

  if (error) {
    console.error('[follows] delete error:', error)
    return NextResponse.json({ error: 'Failed to unfollow.' }, { status: 500 })
  }

  const { data: updated } = await supabase
    .from('profiles')
    .select('follower_count')
    .eq('id', sellerId)
    .single()

  return NextResponse.json({ following: false, followerCount: updated?.follower_count ?? 0 })
}
