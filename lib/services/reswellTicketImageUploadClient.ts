'use client'

import { createClient } from '@/lib/supabase/client'
import { RESWELL_TICKET_IMAGES_BUCKET } from '@/lib/reswell-ticket-images-bucket'

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.8
const SKIP_COMPRESS_BYTES = 400_000

export async function compressTicketImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file
  if (file.size <= SKIP_COMPRESS_BYTES) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= 1_200_000) {
    bitmap.close()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
}

/** Direct browser → Storage upload. Faster than proxying the file through the API. */
export async function uploadTicketImageFromBrowser(
  ticketId: string,
  file: File,
): Promise<string> {
  const prepared = await compressTicketImage(file)
  const ext = prepared.type === 'image/png' ? 'png' : prepared.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${ticketId}/${crypto.randomUUID()}.${ext}`
  const supabase = createClient()
  const { error } = await supabase.storage.from(RESWELL_TICKET_IMAGES_BUCKET).upload(path, prepared, {
    contentType: prepared.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(RESWELL_TICKET_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
