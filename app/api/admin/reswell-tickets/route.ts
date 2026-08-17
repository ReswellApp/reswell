import { NextResponse } from 'next/server'
import { requireAdminOrEmployee } from '@/lib/brands/admin-server'
import {
  createReswellTicketService,
  getReswellTicketsSnapshot,
} from '@/lib/services/reswellTickets'

export async function GET() {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  try {
    const data = await getReswellTicketsSnapshot(gate.ctx.supabase, gate.ctx.user.id)
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load tickets'
    console.error('[api/admin/reswell-tickets] GET', message)
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 })
  }
}

export async function POST() {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  try {
    const ticket = await createReswellTicketService(gate.ctx.supabase, gate.ctx.user.id)
    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create ticket'
    console.error('[api/admin/reswell-tickets] POST', message)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
