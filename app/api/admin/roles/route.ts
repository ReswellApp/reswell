import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'haydensbsb@gmail.com'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser?.email || currentUser.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'Only the super admin can grant or revoke roles' }, { status: 403 })
  }

  const body = await request.json()
  const { email, role, grant } = body as { email?: string; role?: 'admin' | 'employee'; grant?: boolean }

  if (!email || !role || typeof grant !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing or invalid body: email (string), role ("admin" | "employee"), grant (boolean)' },
      { status: 400 }
    )
  }

  if (role !== 'admin' && role !== 'employee') {
    return NextResponse.json({ error: 'role must be "admin" or "employee"' }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const { data: { users }, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })
  }

  const targetUser = users?.find((u) => u.email?.toLowerCase() === normalizedEmail)
  if (!targetUser) {
    return NextResponse.json({ error: 'No account found with that email' }, { status: 404 })
  }

  const { data: profile } = await admin.from('profiles').select('id, is_admin, is_employee').eq('id', targetUser.id).single()
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found for this user' }, { status: 404 })
  }

  const updates: { is_admin?: boolean; is_employee?: boolean } = {}
  if (role === 'admin') {
    updates.is_admin = grant
    if (grant) updates.is_employee = false
  } else {
    updates.is_employee = grant
    if (grant) updates.is_admin = false
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', targetUser.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    user_id: targetUser.id,
    email: targetUser.email,
    [role]: grant,
  })
}
