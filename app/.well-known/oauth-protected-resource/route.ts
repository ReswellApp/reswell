import { NextResponse } from "next/server"
import { buildMcpProtectedResourceMetadata } from "@/lib/services/mcpMetadata"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(buildMcpProtectedResourceMetadata(), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
