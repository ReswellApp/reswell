import { buildSitemapUrlEntries } from "@/lib/sitemap/build-sitemap-entries"
import { escapeXmlText } from "@/lib/utils/xml-escape"

export const revalidate = 3600

function renderSitemapXml(entries: Awaited<ReturnType<typeof buildSitemapUrlEntries>>): string {
  let content = '<?xml version="1.0" encoding="UTF-8"?>\n'
  content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  for (const item of entries) {
    content += "<url>\n"
    content += `<loc>${escapeXmlText(item.url)}</loc>\n`
    const serializedDate =
      item.lastModified instanceof Date ? item.lastModified.toISOString() : String(item.lastModified)
    content += `<lastmod>${escapeXmlText(serializedDate)}</lastmod>\n`
    content += `<changefreq>${escapeXmlText(item.changeFrequency)}</changefreq>\n`
    content += `<priority>${item.priority}</priority>\n`
    content += "</url>\n"
  }

  content += "</urlset>\n"
  return content
}

export async function GET() {
  const entries = await buildSitemapUrlEntries()
  const xml = renderSitemapXml(entries)

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
