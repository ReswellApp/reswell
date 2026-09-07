import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrEmployee } from '@/lib/brands/admin-server'
import {
  addReswellTicketFileService,
  deleteReswellTicketFileService,
} from '@/lib/services/reswellTickets'
import {
  createReswellTicketFileSchema,
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
  const parsed = createReswellTicketFileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const file = await addReswellTicketFileService(gate.ctx.supabase, {
      ticketId: id,
      kind: parsed.data.kind,
      url: parsed.data.url,
      label: parsed.data.label,
      createdBy: gate.ctx.user.id,
    })
    return NextResponse.json({ data: file }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add file'
    console.error('[api/admin/reswell-tickets/:id/files] POST', message)
    const status = message === 'Ticket not found' ? 404 : 500
    return NextResponse.json(
      { error: status === 404 ? message : 'Failed to add file' },
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
    await deleteReswellTicketFileService(gate.ctx.supabase, parsed.data.id)
    return NextResponse.json({ data: { id: parsed.data.id } }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete file'
    console.error('[api/admin/reswell-tickets/:id/files] DELETE', message)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
