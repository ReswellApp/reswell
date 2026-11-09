import { NextResponse } from "next/server"
import { buildReswellShopWidgetHtml } from "@/lib/mcp-widgets/shop-widget-html"

/**
 * Local/preview surface for the Reswell MCP Apps shop widget HTML.
 * Not linked from production nav — open /dev/mcp-shop-widget while developing.
 */
export async function GET() {
  return new NextResponse(buildReswellShopWidgetHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
