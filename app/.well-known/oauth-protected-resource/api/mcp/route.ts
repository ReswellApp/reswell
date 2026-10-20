import { NextResponse } from "next/server"
import { buildMcpProtectedResourceMetadata } from "@/lib/services/mcpMetadata"

/** Path-based PRM discovery for resource https://…/api/mcp (RFC 9728). */
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(buildMcpProtectedResourceMetadata(), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
