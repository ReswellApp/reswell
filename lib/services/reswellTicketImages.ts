import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { insertReswellTicketFile, updateReswellTicketRow } from '@/lib/db/reswellTickets'
import { RESWELL_TICKET_IMAGES_BUCKET } from '@/lib/reswell-ticket-images-bucket'
import type { ReswellTicketFile } from '@/lib/types/reswellTickets'

export { RESWELL_TICKET_IMAGES_BUCKET }
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export interface UploadedTicketDescriptionImage {
  url: string
  file: ReswellTicketFile
}

function extensionForType(type: string): string {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

export async function uploadReswellTicketDescriptionImage(
  userClient: SupabaseClient,
  input: { ticketId: string; file: File; createdBy: string },
): Promise<UploadedTicketDescriptionImage> {
  if (!ALLOWED_TYPES.has(input.file.type)) {
    throw new Error('Use a JPEG, PNG, WebP, or GIF image')
  }
  if (input.file.size > MAX_BYTES) {
    throw new Error('Image is too large (max 8 MB)')
  }

  const storage = (() => {
    try {
      return createServiceRoleClient()
    } catch {
      return userClient
    }
  })()

  const ext = extensionForType(input.file.type)
  const path = `${input.ticketId}/${randomUUID()}.${ext}`
  const bytes = new Uint8Array(await input.file.arrayBuffer())

  const { error: uploadError } = await storage.storage
    .from(RESWELL_TICKET_IMAGES_BUCKET)
    .upload(path, bytes, {
      contentType: input.file.type,
      upsert: false,
    })
  if (uploadError) {
    console.error('[reswell-tickets] image upload:', uploadError.message)
    throw new Error('Could not upload image')
  }

  const { data } = storage.storage.from(RESWELL_TICKET_IMAGES_BUCKET).getPublicUrl(path)
  const url = data.publicUrl
  const label = input.file.name.trim() || 'Image'

  const row = await insertReswellTicketFile(userClient, {
    ticketId: input.ticketId,
    kind: 'image',
    url,
    label,
    createdBy: input.createdBy,
  })

  await updateReswellTicketRow(userClient, input.ticketId, {
    description_image_url: url,
  })

  return {
    url,
    file: {
      id: row.id,
      ticketId: row.ticket_id,
      kind: row.kind,
      label: row.label,
      url: row.url,
      createdBy: row.created_by,
      createdAt: row.created_at,
    },
  }
}
