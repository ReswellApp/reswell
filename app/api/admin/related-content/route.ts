import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listRelatedContentHostsForAdminService } from "@/lib/services/listingRelatedContent"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listRelatedContentHostsForAdminService()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { hosts: result.hosts } }, { status: 200 })
}
