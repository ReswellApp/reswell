import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { getDynamicPageType } from "@/lib/seo/dynamic-page-types"
import { suggestPageSeo } from "@/lib/services/seoAiSuggest"

const schema = z.object({
  pageKey: z.string().min(1),
  currentTitle: z.string().max(400).optional().default(""),
  currentDescription: z.string().max(800).optional().default(""),
  keywords: z.array(z.string()).max(30).optional(),
})

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const managed = getManagedPage(parsed.data.pageKey)
  const dynamic = managed ? null : getDynamicPageType(parsed.data.pageKey)
  if (!managed && !dynamic) {
    return NextResponse.json({ error: "Unknown page" }, { status: 404 })
  }

  const label = managed?.label ?? dynamic?.label ?? "Page"
  const path = managed?.defaults.path ?? dynamic?.samplePath ?? "/"

  const result = await suggestPageSeo({
    label,
    path,
    currentTitle: parsed.data.currentTitle,
    currentDescription: parsed.data.currentDescription,
    keywords: parsed.data.keywords,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.suggestion }, { status: 200 })
}
