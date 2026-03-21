import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Updates the signed-in user's last_active_at. Called periodically from the client.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('profiles').update({ last_active_at: now }).eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
