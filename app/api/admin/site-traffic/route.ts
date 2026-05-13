import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getSiteTrafficDashboardForAdmin } from '@/lib/services/siteTraffic'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.object({
  /** Number of calendar months included in `byMonth` (including partial current month when present). */
  months: z.coerce.number().int().min(1).max(60).optional().default(24),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_employee) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  }

  try {
    const result = await getSiteTrafficDashboardForAdmin(parsed.data.months)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 })
    }
    return NextResponse.json({ data: result.data }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Could not load site traffic' }, { status: 500 })
  }
}
