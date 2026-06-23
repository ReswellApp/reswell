import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getAdminUserDetail } from "@/lib/services/adminUserDetail"
import { adminWalletUserIdParamSchema } from "@/lib/validations/admin-user-wallet"

/**
 * GET /api/admin/users/[userId]
 *
 * Profile + listings for the admin user detail screen (service role).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const { userId: rawId } = await context.params
  const parsed = adminWalletUserIdParamSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
  }

  const result = await getAdminUserDetail(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
