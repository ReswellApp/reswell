/**
 * Pure JSON-LD (schema.org) builders. Safe to import from client (admin templates/preview)
 * and server (page rendering). Output objects are serialized into <script type="application/ld+json">.
 */

export const ORGANIZATION_NAME = "Reswell"

type JsonLdObject = Record<string, unknown>

/** Site-wide Organization node — identifies the brand to search engines. */
export function organizationSchema(origin: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION_NAME,
    url: origin,
    logo: `${origin}/images/reswell-logo.svg`,
  }
}

/** Site-wide WebSite node with a sitelinks search box (Google can render an inline search). */
export function webSiteSchema(origin: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ORGANIZATION_NAME,
    url: origin,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export interface BreadcrumbItem {
  name: string
  /** Absolute URL. */
  url: string
}

export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export interface FaqEntry {
  question: string
  answer: string
}

export function faqPageSchema(entries: FaqEntry[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: { "@type": "Answer", text: e.answer },
    })),
  }
}

export interface ProductSchemaInput {
  name: string
  description?: string
  image?: string | string[]
  brand?: string
  sku?: string
  url: string
  price?: number
  priceCurrency?: string
  availability?: "InStock" | "OutOfStock" | "SoldOut"
  condition?: "NewCondition" | "UsedCondition" | "RefurbishedCondition"
}

export function productSchema(input: ProductSchemaInput): JsonLdObject {
  const offers: JsonLdObject = {
    "@type": "Offer",
    url: input.url,
    priceCurrency: input.priceCurrency ?? "USD",
    availability: `https://schema.org/${input.availability ?? "InStock"}`,
    itemCondition: `https://schema.org/${input.condition ?? "UsedCondition"}`,
  }
  if (typeof input.price === "number") offers.price = input.price.toFixed(2)

  const node: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url: input.url,
    offers,
  }
  if (input.description) node.description = input.description
  if (input.image) node.image = input.image
  if (input.brand) node.brand = { "@type": "Brand", name: input.brand }
  if (input.sku) node.sku = input.sku
  return node
}

/**
 * Parse admin-entered custom JSON-LD (string or already-parsed value) into an array of nodes.
 * Returns [] on invalid input so a bad paste never breaks page render.
 */
export function parseCustomStructuredData(raw: unknown): JsonLdObject[] {
  if (raw == null) return []
  let value: unknown = raw
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      value = JSON.parse(trimmed)
    } catch {
      return []
    }
  }
  if (Array.isArray(value)) {
    return value.filter((v): v is JsonLdObject => typeof v === "object" && v !== null)
  }
  if (typeof value === "object") return [value as JsonLdObject]
  return []
}

/** JSON for the admin "insert template" buttons. Pretty-printed for the textarea. */
export function structuredDataTemplate(
  kind: "organization" | "website" | "breadcrumb" | "faq" | "product",
  origin: string,
): string {
  switch (kind) {
    case "organization":
      return JSON.stringify(organizationSchema(origin), null, 2)
    case "website":
      return JSON.stringify(webSiteSchema(origin), null, 2)
    case "breadcrumb":
      return JSON.stringify(
        breadcrumbSchema([
          { name: "Home", url: origin },
          { name: "Example", url: `${origin}/example` },
        ]),
        null,
        2,
      )
    case "faq":
      return JSON.stringify(
        faqPageSchema([
          { question: "How does Reswell work?", answer: "Buy and sell surfboards peer to peer." },
        ]),
        null,
        2,
      )
    case "product":
      return JSON.stringify(
        productSchema({
          name: "Example surfboard",
          url: `${origin}/l/example`,
          price: 499,
          brand: "Brand",
        }),
        null,
        2,
      )
  }
}
