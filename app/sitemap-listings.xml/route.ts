import { buildListingSitemapUrlEntries } from "@/lib/sitemap/build-sitemap-entries"
import { renderUrlSetXml } from "@/lib/sitemap/render-sitemap-xml"

export const revalidate = 3600

export async function GET() {
  const entries = await buildListingSitemapUrlEntries()
  const xml = renderUrlSetXml(entries)

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
