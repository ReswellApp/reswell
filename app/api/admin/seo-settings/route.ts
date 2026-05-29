import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { seoSettingsWriteSchema } from "@/lib/validations/seo-settings"
import { getSeoSettingsService, saveSeoSettingsService } from "@/lib/services/seoSettings"
import { SEO_SETTINGS_CACHE_TAG } from "@/lib/seo/seo-settings-cache"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const settings = await getSeoSettingsService(gate.ctx.supabase)
  return NextResponse.json({ data: { settings } }, { status: 200 })
}

export async function PUT(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = seoSettingsWriteSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await saveSeoSettingsService(gate.ctx.supabase, parsed.data, gate.ctx.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  revalidateTag(SEO_SETTINGS_CACHE_TAG)
  revalidatePath("/robots.txt")

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
