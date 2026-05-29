import type { ReactElement } from "react"

type JsonLdObject = Record<string, unknown>

/**
 * Renders one or more JSON-LD nodes as <script type="application/ld+json"> tags.
 * Server component — emits inline scripts safe for search-engine structured data.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }): ReactElement | null {
  const nodes = Array.isArray(data) ? data : [data]
  if (nodes.length === 0) return null
  return (
    <>
      {nodes.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
    </>
  )
}
