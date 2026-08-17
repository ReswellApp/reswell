import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrEmployee } from '@/lib/brands/admin-server'
import {
  deleteReswellTicketService,
  updateReswellTicketService,
} from '@/lib/services/reswellTickets'
import { updateReswellTicketSchema } from '@/lib/validations/reswellTickets'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const body: unknown = await req.json().catch(() => null)
  const parsed = updateReswellTicketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const ticket = await updateReswellTicketService(gate.ctx.supabase, id, parsed.data)
    return NextResponse.json({ data: ticket }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update ticket'
    console.error('[api/admin/reswell-tickets/:id] PATCH', message)
    const status = message === 'Ticket not found' ? 404 : 500
    return NextResponse.json(
      { error: status === 404 ? message : 'Failed to update ticket' },
      { status },
    )
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  try {
    await deleteReswellTicketService(gate.ctx.supabase, id)
    return NextResponse.json({ data: { id } }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete ticket'
    console.error('[api/admin/reswell-tickets/:id] DELETE', message)
    const status = message === 'Ticket not found' ? 404 : 500
    return NextResponse.json(
      { error: status === 404 ? message : 'Failed to delete ticket' },
      { status },
    )
  }
}
