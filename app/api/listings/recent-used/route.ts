import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LIMIT = 50

export async function GET() {
  const supabase = await createClient()

  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      price,
      condition,
      created_at,
      listing_images (url, is_primary),
      categories (name, slug)
    `)
    .eq('status', 'active')
    .eq('section', 'used')
    .eq('shipping_available', true)
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(listings ?? [])
}
