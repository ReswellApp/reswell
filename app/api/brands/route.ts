import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const section = searchParams.get('section') || ''

  const sections = section === 'used' ? ['used'] : section === 'surfboards' ? ['surfboards'] : ['used', 'surfboards']

  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('brand')
    .eq('status', 'active')
    .in('section', sections)
    .not('brand', 'is', null)

  const set = new Set<string>()
  const brands = (data || [])
    .map((r) => r.brand?.trim())
    .filter((b): b is string => !!b && b.length > 0)
    .filter((b) => {
      const key = b.toLowerCase()
      if (set.has(key)) return false
      set.add(key)
      return true
    })
    .sort((a, b) => a.localeCompare(b))

  return NextResponse.json(brands)
}
