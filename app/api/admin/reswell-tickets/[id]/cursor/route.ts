import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrEmployee } from '@/lib/brands/admin-server'
import { CursorCloudAgentError } from '@/lib/services/cursorCloudAgent'
import {
  dispatchReswellTicketCursorService,
  followUpReswellTicketCursorService,
  syncReswellTicketCursorService,
} from '@/lib/services/reswellTicketCursor'
import { reswellTicketCursorActionSchema } from '@/lib/validations/reswellTickets'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const body: unknown = await req.json().catch(() => null)
  const parsed = reswellTicketCursorActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const ticket =
      parsed.data.action === 'dispatch'
        ? await dispatchReswellTicketCursorService(
            gate.ctx.supabase,
            id,
            gate.ctx.user.id,
            parsed.data.force ?? false,
          )
        : parsed.data.action === 'follow_up'
          ? await followUpReswellTicketCursorService(
              gate.ctx.supabase,
              id,
              gate.ctx.user.id,
              parsed.data.text,
            )
          : await syncReswellTicketCursorService(gate.ctx.supabase, id, gate.ctx.user.id)

    return NextResponse.json({ data: ticket }, { status: parsed.data.action === 'sync' ? 200 : 201 })
  } catch (error) {
    if (error instanceof CursorCloudAgentError) {
      console.error('[api/admin/reswell-tickets/:id/cursor] POST', {
        ticketId: id,
        userId: gate.ctx.user.id,
        status: error.statusCode,
        timestamp: new Date().toISOString(),
      })
      return NextResponse.json(
        { error: error.expose ? error.message : 'Could not talk to Cursor' },
        { status: error.statusCode },
      )
    }

    const message = error instanceof Error ? error.message : 'Failed to update Cursor agent'
    console.error('[api/admin/reswell-tickets/:id/cursor] POST', message)
    const status = message === 'Ticket not found' ? 404 : 500
    return NextResponse.json(
      { error: status === 404 ? message : 'Failed to update Cursor agent' },
      { status },
    )
  }
}
