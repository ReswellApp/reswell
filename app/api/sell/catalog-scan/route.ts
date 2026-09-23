import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  runSellCatalogImageMatch,
  SellCatalogImageScanDisabledError,
  SellCatalogImageScanReadError,
} from "@/lib/services/sellCatalogImageMatch"
import {
  isSellCatalogScanMediaType,
  normalizeSellCatalogScanImage,
  SELL_CATALOG_SCAN_MAX_BYTES,
} from "@/lib/services/sellCatalogImageNormalize"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

export const maxDuration = 60

/**
 * POST `/api/sell/catalog-scan`
 * Admin-only: scan a photo and match it to a surfboard or fin in the catalog.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Add a photo to scan." }, { status: 400 })
    }
    if (file.size > SELL_CATALOG_SCAN_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Photo must be ${(SELL_CATALOG_SCAN_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB or smaller.`,
        },
        { status: 413 },
      )
    }

    const declaredType = (file.type || "").toLowerCase()
    if (declaredType && !isSellCatalogScanMediaType(declaredType)) {
      return NextResponse.json(
        { error: "Use a JPEG, PNG, or WebP photo." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const image = await normalizeSellCatalogScanImage(buffer)
    const supabase = createAnonSupabaseClient()
    const data = await runSellCatalogImageMatch(supabase, image)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof SellCatalogImageScanDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof SellCatalogImageScanReadError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }

    console.error(
      "[api/sell/catalog-scan]",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: "Could not match that photo. Please try again." },
      { status: 500 },
    )
  }
}
