import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listBrands } from "@/lib/brands/server"

/**
 * Catalog entries for surfboard listing forms: one row per brand (no scraped model list).
 */
export async function GET() {
  const supabase = await createClient()
  const brands = await listBrands(supabase)
  const items = brands.map((b) => ({
    brandSlug: b.slug,
    modelSlug: "",
    brandName: b.name,
    modelName: "",
    label: b.name,
  }))
  return NextResponse.json({ items })
}
