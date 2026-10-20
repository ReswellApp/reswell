import type { SitemapUrlEntry } from "@/lib/sitemap/types"
import { escapeXmlText } from "@/lib/utils/xml-escape"

export function renderUrlSetXml(entries: SitemapUrlEntry[]): string {
  const hasImages = entries.some((entry) => (entry.images?.length ?? 0) > 0)
  const xmlns = hasImages
    ? ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

  let content = '<?xml version="1.0" encoding="UTF-8"?>\n'
  content += `<urlset${xmlns}>\n`

  for (const item of entries) {
    content += "<url>\n"
    content += `<loc>${escapeXmlText(item.url)}</loc>\n`
    const serializedDate =
      item.lastModified instanceof Date ? item.lastModified.toISOString() : String(item.lastModified)
    content += `<lastmod>${escapeXmlText(serializedDate)}</lastmod>\n`
    content += `<changefreq>${escapeXmlText(item.changeFrequency)}</changefreq>\n`
    content += `<priority>${item.priority}</priority>\n`
    for (const image of item.images ?? []) {
      content += "<image:image>\n"
      content += `<image:loc>${escapeXmlText(image)}</image:loc>\n`
      content += "</image:image>\n"
    }
    content += "</url>\n"
  }

  content += "</urlset>\n"
  return content
}

export type SitemapIndexChild = {
  url: string
  lastModified: Date
}

export function renderSitemapIndexXml(children: SitemapIndexChild[]): string {
  let content = '<?xml version="1.0" encoding="UTF-8"?>\n'
  content += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  for (const item of children) {
    content += "<sitemap>\n"
    content += `<loc>${escapeXmlText(item.url)}</loc>\n`
    content += `<lastmod>${escapeXmlText(item.lastModified.toISOString())}</lastmod>\n`
    content += "</sitemap>\n"
  }

  content += "</sitemapindex>\n"
  return content
}
