import { resolveEffectivePageSeo } from "@/lib/seo/resolve-page-seo"
import { parseCustomStructuredData } from "@/lib/seo/structured-data"
import { JsonLd } from "@/components/seo/json-ld"

/**
 * Emits custom JSON-LD for a managed page when set in `lib/seo/managed-pages.ts`.
 * Drop near the top of a managed page's JSX: `<PageStructuredData pageKey="faq" />`.
 * Renders nothing when no structured data is set.
 */
export async function PageStructuredData({ pageKey }: { pageKey: string }) {
  const eff = await resolveEffectivePageSeo(pageKey)
  const nodes = parseCustomStructuredData(eff?.structuredData)
  if (nodes.length === 0) return null
  return <JsonLd data={nodes} />
}
