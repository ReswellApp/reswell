import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export async function GET() {
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

  const t3 = isoMinutesAgo(3)
  const t15 = isoMinutesAgo(15)
  const t60 = isoMinutesAgo(60)

  const [
    { count: activeNow, error: e1 },
    { count: last15m, error: e2 },
    { count: lastHour, error: e3 },
    { data: activeUsers, error: e4 },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_active_at', t3),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_active_at', t15),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_active_at', t60),
    supabase
      .from('profiles')
      .select('id, display_name, email, last_active_at')
      .gte('last_active_at', t3)
      .order('last_active_at', { ascending: false })
      .limit(200),
  ])

  const err = e1 || e2 || e3 || e4
  if (err) {
    return NextResponse.json({ error: 'Failed to load live stats' }, { status: 500 })
  }

  return NextResponse.json({
    activeNow: activeNow ?? 0,
    last15Minutes: last15m ?? 0,
    lastHour: lastHour ?? 0,
    activeUsers: activeUsers ?? [],
    windows: { activeNowMinutes: 3, recentMinutes: 15, hourMinutes: 60 },
    fetchedAt: new Date().toISOString(),
  })
}
