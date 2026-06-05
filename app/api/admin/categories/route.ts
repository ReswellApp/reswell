import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { USED_WETSUITS_CATEGORY_ID } from "@/lib/wetsuit-listing-config"
import { USED_BOARDBAGS_CATEGORY_ID } from "@/lib/boardbag-listing-config"
import { USED_SURFPACKS_CATEGORY_ID } from "@/lib/surfpack-listing-config"
import { USED_LEASHES_CATEGORY_ID } from "@/lib/leash-listing-config"
import { USED_APPAREL_CATEGORY_ID } from "@/lib/apparel-listing-config"
import { USED_ACCESSORIES_CATEGORY_ID } from "@/lib/accessory-listing-config"
import { ADMIN_LISTING_SECTIONS } from "@/lib/validations/admin-listing-category"
import { canonicalSurfboardCategoryName } from "@/lib/surfboard-category-display"

/** Sections that resolve to a single fixed category row (board_type null). */
const FIXED_CATEGORY_SECTIONS: Record<string, { categoryId: string; fallbackName: string }> = {
  fins: { categoryId: USED_FINS_CATEGORY_ID, fallbackName: "Fins" },
  wetsuits: { categoryId: USED_WETSUITS_CATEGORY_ID, fallbackName: "Wetsuits" },
  boardbags: { categoryId: USED_BOARDBAGS_CATEGORY_ID, fallbackName: "Boardbags" },
  surfpacks: { categoryId: USED_SURFPACKS_CATEGORY_ID, fallbackName: "Surfpacks" },
  leashes: { categoryId: USED_LEASHES_CATEGORY_ID, fallbackName: "Leashes" },
  apparel: { categoryId: USED_APPAREL_CATEGORY_ID, fallbackName: "Apparel" },
  accessories: { categoryId: USED_ACCESSORIES_CATEGORY_ID, fallbackName: "Accessories" },
}

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
 * surfboards, false for shop (section=new), or the single used-fins row (section=fins).
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
  if (!section || !(ADMIN_LISTING_SECTIONS as readonly string[]).includes(section)) {
    return NextResponse.json(
      { error: `Query "section" must be one of: ${ADMIN_LISTING_SECTIONS.join(", ")}` },
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

  const fixedCategory = FIXED_CATEGORY_SECTIONS[section]
  if (fixedCategory) {
    const { data, error } = await service
      .from("categories")
      .select("id, name, slug, board")
      .eq("id", fixedCategory.categoryId)
      .maybeSingle()

    if (error) {
      console.error(`[admin categories GET] ${section}:`, error)
      return NextResponse.json({ error: "Failed to load categories" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json(
        { error: `${fixedCategory.fallbackName} category is missing — apply the marketplace migration first.` },
        { status: 404 },
      )
    }

    return NextResponse.json({
      categories: [
        {
          id: data.id,
          name: data.name ?? fixedCategory.fallbackName,
          slug: data.slug,
          board: data.board,
        },
      ],
    })
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
