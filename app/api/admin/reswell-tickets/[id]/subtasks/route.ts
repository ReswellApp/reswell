import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrEmployee } from '@/lib/brands/admin-server'
import {
  addReswellTicketSubtaskService,
  deleteReswellTicketSubtaskService,
  updateReswellTicketSubtaskService,
} from '@/lib/services/reswellTickets'
import {
  createReswellTicketSubtaskSchema,
  deleteByIdSchema,
  updateReswellTicketSubtaskSchema,
} from '@/lib/validations/reswellTickets'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const body: unknown = await req.json().catch(() => null)
  const parsed = createReswellTicketSubtaskSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const subtask = await addReswellTicketSubtaskService(
      gate.ctx.supabase,
      id,
      parsed.data.title ?? '',
    )
    return NextResponse.json({ data: subtask }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add sub-task'
    console.error('[api/admin/reswell-tickets/:id/subtasks] POST', message)
    const status = message === 'Ticket not found' ? 404 : 500
    return NextResponse.json(
      { error: status === 404 ? message : 'Failed to add sub-task' },
      { status },
    )
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const body: unknown = await req.json().catch(() => null)
  const parsed = updateReswellTicketSubtaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const subtask = await updateReswellTicketSubtaskService(gate.ctx.supabase, parsed.data)
    return NextResponse.json({ data: subtask }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update sub-task'
    console.error('[api/admin/reswell-tickets/:id/subtasks] PATCH', message)
    return NextResponse.json({ error: 'Failed to update sub-task' }, { status: 500 })
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
    await deleteReswellTicketSubtaskService(gate.ctx.supabase, parsed.data.id)
    return NextResponse.json({ data: { id: parsed.data.id } }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete sub-task'
    console.error('[api/admin/reswell-tickets/:id/subtasks] DELETE', message)
    return NextResponse.json({ error: 'Failed to delete sub-task' }, { status: 500 })
  }
}
