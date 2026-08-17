import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrEmployee } from '@/lib/brands/admin-server'
import { uploadReswellTicketDescriptionImage } from '@/lib/services/reswellTicketImages'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Drop an image file' }, { status: 400 })
  }

  try {
    const data = await uploadReswellTicketDescriptionImage(gate.ctx.supabase, {
      ticketId: id,
      file,
      createdBy: gate.ctx.user.id,
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload image'
    console.error('[api/admin/reswell-tickets/:id/description-image]', message)
    const status =
      message === 'Ticket not found'
        ? 404
        : message.startsWith('Use a') || message.startsWith('Image is')
          ? 400
          : 500
    return NextResponse.json(
      { error: status === 500 ? 'Failed to upload image' : message },
      { status },
    )
  }
}
