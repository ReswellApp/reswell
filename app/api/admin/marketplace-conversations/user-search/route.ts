import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { searchProfilesForAdminMessaging } from "@/lib/services/adminStartMarketplaceConversation"
import { adminMarketplaceUserSearchQuerySchema } from "@/lib/validations/adminStartMarketplaceConversation"

/**
 * GET /api/admin/marketplace-conversations/user-search?q=&limit=
 *
 * Typeahead for starting a staff↔member thread (min 2 characters).
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = adminMarketplaceUserSearchQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const { rows, error } = await searchProfilesForAdminMessaging(parsed.data.q, parsed.data.limit)

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ data: rows })
}
