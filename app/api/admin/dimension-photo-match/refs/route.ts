import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listSurfboardDimensionPhotoRefs } from "@/lib/db/surfboardDimensionPhoto"
import { scanSurfboardListingsForDimensionPhotos } from "@/lib/services/surfboardDimensionPhotoMatch"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  seedSurfboardDimensionPhotoRefsSchema,
  surfboardDimensionPhotoRefListQuerySchema,
} from "@/lib/validations/surfboardDimensionPhoto"

export const maxDuration = 300

function loadError(message: string): string {
  if (/does not exist|schema cache|relation/i.test(message)) {
    return "Dimension photo tables are missing. Apply migrations 20271201120000 and 20271201130000, then refresh."
  }
  return "Could not load reference photos"
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = surfboardDimensionPhotoRefListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    )
  }

  const list = await listSurfboardDimensionPhotoRefs(service, {
    q: parsed.data.q,
    active: parsed.data.active,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  })

  if (list.error) {
    return NextResponse.json({ error: loadError(list.error.message) }, { status: 500 })
  }

  return NextResponse.json({
    data: { refs: list.data, total: list.total },
  })
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const raw = await request.json().catch(() => ({}))
  const parsed = seedSurfboardDimensionPhotoRefsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid seed request" }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    )
  }

  // Vision-scan listing galleries (find dimensions photo + read L×W×T). Can take a while.
  const result = await scanSurfboardListingsForDimensionPhotos(service, {
    limit: parsed.data.limit,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      scanned: result.scanned,
      found: result.found,
      skipped: result.skipped,
      // Back-compat keys for older admin clients
      inserted: result.found,
      updated: 0,
    },
  })
}
