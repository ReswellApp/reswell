import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { getPageSearchPerformance, isSearchConsoleConfigured } from "@/lib/services/searchConsole"

const schema = z.object({ pageKey: z.string().min(1) })

/** Per-page Search Console performance for the admin SEO panel. Loaded on demand. */
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  try {
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    if (!isSearchConsoleConfigured()) {
      return NextResponse.json(
        { data: { configured: false, reason: "Search Console is not connected." } },
        { status: 200 },
      )
    }

    const managed = getManagedPage(parsed.data.pageKey)
    if (!managed) {
      return NextResponse.json({ error: "Unknown page" }, { status: 404 })
    }

    const result = await getPageSearchPerformance(managed.defaults.path)
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error("[page-seo/insights] failed", error)
    return NextResponse.json(
      { data: { configured: false, reason: "Could not load Search Console data." } },
      { status: 200 },
    )
  }
}
