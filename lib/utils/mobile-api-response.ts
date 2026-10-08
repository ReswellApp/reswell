import { NextResponse } from "next/server"
import type { MobileApiResult } from "@/lib/services/mobileApi"

export function mobileDataResponse<T>(result: MobileApiResult<T>, cacheControl: string) {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(
    { data: result.data },
    { status: 200, headers: { "Cache-Control": cacheControl } },
  )
}

export async function readMobileJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function mobileFailure(route: string, error: unknown, fallback: string) {
  console.error("[mobile-api] failed", {
    route,
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
  })
  return NextResponse.json({ error: fallback }, { status: 500 })
}
