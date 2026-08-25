import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildOpenAiCatalogFeed,
  gzipOpenAiCatalogFeed,
  isOpenAiCatalogFeedAuthorized,
  openAiCatalogFeedToCsv,
  openAiCatalogFeedToTsv,
  resolveOpenAiCatalogFeedFormat,
} from "@/lib/services/openaiCatalogFeed"

export const maxDuration = 60

/**
 * ChatGPT Commerce / Ads product feed (OpenAI stable file-upload schema).
 *
 * Feed URL (production):
 *   https://www.reswell.app/api/integrations/openai/catalog-feed?token=YOUR_SECRET
 *
 * Defaults to UTF-8 TSV (OpenAI file-upload / hosted URL). Query `format`:
 *   tsv (default) | csv | json | tsv.gz | csv.gz
 *
 * When `OPENAI_CATALOG_FEED_SECRET` is set, pass it as `?token=` or `Authorization: Bearer`.
 * Includes active peer listings and Reswell shop inventory.
 *
 * Register in ChatGPT Merchant / Ads Manager as a hosted URL, or download and
 * overwrite the same filename on SFTP (`reswell-chatgpt-products.tsv`).
 *
 * @see https://developers.openai.com/commerce/specs/file-upload/products
 */
export async function GET(request: Request) {
  if (!isOpenAiCatalogFeedAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server config: missing service role" },
      { status: 503 },
    )
  }

  try {
    const items = await buildOpenAiCatalogFeed(supabase)
    const format = resolveOpenAiCatalogFeedFormat(request)
    const cacheHeaders = {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    }

    if (format === "json") {
      return NextResponse.json(items, { headers: cacheHeaders })
    }

    const delimited =
      format === "csv" || format === "csv.gz"
        ? openAiCatalogFeedToCsv(items)
        : openAiCatalogFeedToTsv(items)
    const gzip = format === "tsv.gz" || format === "csv.gz"
    const filename = gzip
      ? format === "csv.gz"
        ? "reswell-chatgpt-products.csv.gz"
        : "reswell-chatgpt-products.tsv.gz"
      : format === "csv"
        ? "reswell-chatgpt-products.csv"
        : "reswell-chatgpt-products.tsv"
    const contentType =
      format === "csv" || format === "csv.gz"
        ? "text/csv; charset=utf-8"
        : "text/tab-separated-values; charset=utf-8"

    if (gzip) {
      return new NextResponse(new Uint8Array(gzipOpenAiCatalogFeed(delimited)), {
        status: 200,
        headers: {
          ...cacheHeaders,
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    return new NextResponse(delimited, {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error("[openai] catalog-feed:", e)
    return NextResponse.json({ error: "Failed to build catalog feed" }, { status: 500 })
  }
}
