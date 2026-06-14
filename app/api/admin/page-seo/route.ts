import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listManagedPageSeoReference } from "@/lib/services/pageSeoAdmin"

/** Read-only reference list for the admin SEO panel. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const items = listManagedPageSeoReference()
  return NextResponse.json({ data: { items } }, { status: 200 })
}
