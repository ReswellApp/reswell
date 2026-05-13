import { publicSiteOrigin } from "@/lib/public-site-origin"
import { renderSitemapIndexXml } from "@/lib/sitemap/render-sitemap-xml"

export const revalidate = 3600

export async function GET() {
  const base = publicSiteOrigin()
  const now = new Date()

  const xml = renderSitemapIndexXml([
    { url: `${base}/sitemap-pages.xml`, lastModified: now },
    { url: `${base}/sitemap-listings.xml`, lastModified: now },
  ])

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
