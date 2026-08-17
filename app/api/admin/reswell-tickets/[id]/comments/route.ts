import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrEmployee } from '@/lib/brands/admin-server'
import {
  addReswellTicketCommentService,
  deleteReswellTicketCommentService,
} from '@/lib/services/reswellTickets'
import {
  createReswellTicketCommentSchema,
  deleteByIdSchema,
} from '@/lib/validations/reswellTickets'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const body: unknown = await req.json().catch(() => null)
  const parsed = createReswellTicketCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const comment = await addReswellTicketCommentService(
      gate.ctx.supabase,
      id,
      gate.ctx.user.id,
      parsed.data.body,
    )
    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add comment'
    console.error('[api/admin/reswell-tickets/:id/comments] POST', message)
    const status = message === 'Ticket not found' ? 404 : 500
    return NextResponse.json(
      { error: status === 404 ? message : 'Failed to add comment' },
      { status },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const body: unknown = await req.json().catch(() => null)
  const parsed = deleteByIdSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    await deleteReswellTicketCommentService(gate.ctx.supabase, parsed.data.id)
    return NextResponse.json({ data: { id: parsed.data.id } }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete comment'
    console.error('[api/admin/reswell-tickets/:id/comments] DELETE', message)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
