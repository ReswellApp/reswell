import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { updateProfileDefaultListingLocality } from "@/lib/db/profileDefaultListingLocality"

const saveDefaultListingLocationSchema = z.object({
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().max(80).optional(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  display: z.string().trim().max(300).optional(),
})

/**
 * Persists the seller's default listing locality for later /sell visits.
 * Route handler (not a Server Action) so this never refreshes `/sell` and
 * aborts an in-flight listing save.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = saveDefaultListingLocationSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400 })
  }

  const stateTrimmed = (parsed.data.state ?? "").trim()
  const { error } = await updateProfileDefaultListingLocality(supabase, user.id, {
    city: parsed.data.city.trim(),
    state: stateTrimmed ? stateTrimmed : null,
    lat: parsed.data.lat ?? null,
    lng: parsed.data.lng ?? null,
    display: parsed.data.display?.trim() || null,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
