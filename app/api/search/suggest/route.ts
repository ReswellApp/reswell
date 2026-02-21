import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_TITLES = 8
const MAX_CATEGORIES = 5
const MAX_BRANDS = 5

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim().replace(/%/g, '')
  const section = searchParams.get('section') || ''

  if (!q || q.length < 2) {
    return NextResponse.json({ titles: [], categories: [], brands: [] })
  }

  const supabase = await createClient()
  const pattern = `%${q}%`

  const sections = section === 'used' ? ['used'] : section === 'surfboards' ? ['surfboards'] : ['used', 'surfboards']

  const [titlesRes, categoriesRes, brandsRes] = await Promise.all([
    supabase
      .from('listings')
      .select('title')
      .eq('status', 'active')
      .in('section', sections)
      .or(`title.ilike.${pattern}`)
      .limit(MAX_TITLES * 2)
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('name, slug')
      .in('section', sections)
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .limit(MAX_CATEGORIES),
    supabase
      .from('listings')
      .select('brand')
      .eq('status', 'active')
      .in('section', sections)
      .not('brand', 'is', null)
      .ilike('brand', pattern)
      .limit(MAX_BRANDS * 2),
  ])

  const titleSet = new Set<string>()
  const titles = (titlesRes.data || [])
    .map((r) => r.title?.trim())
    .filter((t): t is string => !!t && t.length > 0)
    .filter((t) => {
      if (titleSet.has(t.toLowerCase())) return false
      titleSet.add(t.toLowerCase())
      return true
    })
    .slice(0, MAX_TITLES)

  const categories = (categoriesRes.data || []).map((c) => c.name || c.slug).filter(Boolean).slice(0, MAX_CATEGORIES)

  const brandSet = new Set<string>()
  const brands = (brandsRes.data || [])
    .map((r) => r.brand?.trim())
    .filter((b): b is string => !!b && b.length > 0)
    .filter((b) => {
      if (brandSet.has(b.toLowerCase())) return false
      brandSet.add(b.toLowerCase())
      return true
    })
    .slice(0, MAX_BRANDS)

  return NextResponse.json({ titles, categories, brands })
}
