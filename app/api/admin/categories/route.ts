import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { canonicalSurfboardCategoryName } from "@/lib/surfboard-category-display"

const SUPER_ADMIN_EMAIL = "haydensbsb@gmail.com"

function canAccessAdminListings(
  email: string | undefined,
  profile: { is_admin?: boolean | null; is_employee?: boolean | null } | null,
): boolean {
  if (!email) return false
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return true
  return profile?.is_admin === true || profile?.is_employee === true
}

/**
 * Categories for admin tools (e.g. change listing category). Uses service role so
 * the list matches the database exactly — same filter as sell: `board` true for
 * surfboards, false for shop (section=new).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .single()

  if (!canAccessAdminListings(user.email ?? undefined, profile)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const section = request.nextUrl.searchParams.get("section")?.trim()
  if (section !== "surfboards" && section !== "new") {
    return NextResponse.json(
      { error: 'Query "section" must be "surfboards" or "new"' },
      { status: 400 },
    )
  }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch (e) {
    console.error("[admin categories GET] service role:", e)
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const board = section === "surfboards"
  const { data, error } = await service
    .from("categories")
    .select("id, name, slug, board")
    .eq("board", board)

  if (error) {
    console.error("[admin categories GET]:", error)
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 })
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    name:
      board && row.id
        ? canonicalSurfboardCategoryName({
            id: row.id,
            name: row.name ?? "",
            slug: row.slug,
          })
        : (row.name ?? ""),
    slug: row.slug,
    board: row.board,
  }))
  rows.sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ categories: rows })
}
