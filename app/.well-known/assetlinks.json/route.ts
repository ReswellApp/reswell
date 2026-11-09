import { NextResponse } from "next/server"
import {
  androidAssetLinksFromEnv,
  WELL_KNOWN_JSON_HEADERS,
  WELL_KNOWN_NOT_CONFIGURED_HEADERS,
} from "@/lib/services/appLinks"

export const dynamic = "force-dynamic"

export async function GET() {
  const body = androidAssetLinksFromEnv()
  if (!body) {
    return new NextResponse(null, {
      status: 404,
      headers: WELL_KNOWN_NOT_CONFIGURED_HEADERS,
    })
  }
  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: WELL_KNOWN_JSON_HEADERS,
  })
}
