import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminHomeHeroSlideBodySchema } from "@/lib/validations/home-hero-slides"
import {
  addHomeHeroSlideService,
  listHomeHeroSlidesForAdminService,
} from "@/lib/services/homeHeroSlides"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listHomeHeroSlidesForAdminService(gate.ctx.supabase)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ data: { slides: result.slides } }, { status: 200 })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminHomeHeroSlideBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await addHomeHeroSlideService(parsed.data.image_url)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  revalidatePath("/", "layout")
  revalidatePath("/", "page")
  return NextResponse.json({ data: { id: result.id } }, { status: 201 })
}
