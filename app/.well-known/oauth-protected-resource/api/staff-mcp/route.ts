import { NextResponse } from "next/server"
import { buildStaffMcpProtectedResourceMetadata } from "@/lib/services/mcpMetadata"

/** Path-based PRM discovery for resource https://…/api/staff-mcp (RFC 9728). */
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(buildStaffMcpProtectedResourceMetadata(), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
