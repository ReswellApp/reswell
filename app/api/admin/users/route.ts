import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadAdminUsersDirectory } from '@/lib/services/adminUsersDirectory'

async function requireIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return null
  return user
}

/** Full user directory with listing + sales aggregates for /admin/users. */
export async function GET() {
  const supabase = await createClient()
  const admin = await requireIsAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await loadAdminUsersDirectory()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
