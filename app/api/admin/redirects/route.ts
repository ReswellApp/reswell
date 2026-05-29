import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { seoRedirectWriteSchema } from "@/lib/validations/seo-redirects"
import {
  createSeoRedirectService,
  listSeoRedirectsService,
} from "@/lib/services/seoRedirects"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const redirects = await listSeoRedirectsService(gate.ctx.supabase)
  return NextResponse.json({ data: { redirects } }, { status: 200 })
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

  const parsed = seoRedirectWriteSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await createSeoRedirectService(
    gate.ctx.supabase,
    parsed.data,
    gate.ctx.user.id,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ data: { redirect: result.row } }, { status: 201 })
}
