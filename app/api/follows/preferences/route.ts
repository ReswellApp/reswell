import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET /api/follows/preferences — load the user's notification preferences */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('follow_in_app, follow_email_digest, digest_time')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json(
    prefs ?? { follow_in_app: true, follow_email_digest: true, digest_time: 'morning' }
  )
}

/** PUT /api/follows/preferences — upsert notification preferences */
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const body = await req.json()
  const { follow_in_app, follow_email_digest, digest_time } = body

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: user.id, follow_in_app, follow_email_digest, digest_time },
      { onConflict: 'user_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to save preferences.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
