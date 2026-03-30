import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DisputeEvidenceType } from '@/lib/disputes/types'

type Params = { params: Promise<{ id: string }> }

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/disputes/[id]/evidence — Upload evidence (photo, tracking, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: dispute } = await supabase
    .from('disputes')
    .select('id, buyer_id, seller_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 })

  if (dispute.buyer_id !== user.id && dispute.seller_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const resolvedStatuses = ['RESOLVED_REFUND', 'RESOLVED_NO_REFUND', 'RESOLVED_KEEP_ITEM', 'CLOSED']
  if (resolvedStatuses.includes(dispute.status)) {
    return NextResponse.json({ error: 'This dispute is closed.' }, { status: 409 })
  }

  // Check existing count (max 8 total)
  const { count } = await supabase
    .from('dispute_evidence')
    .select('*', { count: 'exact', head: true })
    .eq('dispute_id', id)
    .eq('uploaded_by', user.id)

  if ((count ?? 0) >= 8) {
    return NextResponse.json({ error: 'Maximum of 8 evidence items allowed.' }, { status: 400 })
  }

  const body = await req.json()
  const { url, type = 'PHOTO', caption } = body as {
    url: string
    type?: DisputeEvidenceType
    caption?: string
  }

  if (!url?.trim()) {
    return NextResponse.json({ error: 'URL is required.' }, { status: 400 })
  }

  const validTypes: DisputeEvidenceType[] = ['PHOTO', 'TRACKING', 'SCREENSHOT', 'OTHER']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid evidence type.' }, { status: 400 })
  }

  const { data: evidence, error } = await supabase
    .from('dispute_evidence')
    .insert({
      dispute_id: id,
      uploaded_by: user.id,
      type,
      url: url.trim(),
      caption: caption?.trim() ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save evidence.' }, { status: 500 })
  }

  return NextResponse.json({ evidence }, { status: 201 })
}
