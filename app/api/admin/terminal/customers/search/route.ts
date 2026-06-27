import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { searchAdminTerminalCustomers } from "@/lib/services/adminTerminalCustomerSearch"
import { adminTerminalCustomerSearchQuerySchema } from "@/lib/validations/adminTerminalCustomerSearch"

/**
 * GET /api/admin/terminal/customers/search?q=&limit=
 *
 * Member picker for in-person terminal checkout (name or email, min 2 characters).
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = adminTerminalCustomerSearchQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const { rows, error } = await searchAdminTerminalCustomers(parsed.data.q, parsed.data.limit)

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ data: { hits: rows } })
}
