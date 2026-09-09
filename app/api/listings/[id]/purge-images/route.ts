import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { purgeListingImageStorageForRowIds } from "@/lib/services/listingImageStoragePurge"
import { createServiceRoleClient } from "@/lib/supabase/server"

const bodySchema = z.object({
  imageRowIds: z.array(z.string().uuid()).min(1),
})

const listingIdSchema = z.string().uuid()

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const idParsed = listingIdSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const result = await purgeListingImageStorageForRowIds(
    supabase,
    service,
    user.id,
    idParsed.data,
    parsed.data.imageRowIds,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
