import { NextRequest, NextResponse } from "next/server"
import { SHOPIFY_CONNECT_PATH } from "@/lib/shopify/claim-path"

export const dynamic = "force-dynamic"

export function GET(request: NextRequest) {
  const destination = request.nextUrl.clone()
  destination.pathname = SHOPIFY_CONNECT_PATH
  return NextResponse.redirect(destination)
}
