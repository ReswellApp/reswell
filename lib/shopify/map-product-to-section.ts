import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isPeerListingSectionValue } from "@/lib/shopify/section-registry"
import type {
  ShopifyRestProduct,
  ShopifySectionMappingRow,
  ShopifySectionSignalType,
} from "@/lib/shopify/types"

const SECTION_KEYWORD_RULES: Array<{ keywords: string[]; section: PeerListingSection }> = [
  { keywords: ["surfboard", "board", "shortboard", "longboard", "hybrid", "fish", "groveler"], section: "surfboards" },
  { keywords: ["fin", "fins", "thruster", "twin fin", "quad fin"], section: "fins" },
  { keywords: ["wetsuit", "springsuit", "steamer", "shorty"], section: "wetsuits" },
  { keywords: ["boardbag", "board bag", "day bag", "travel bag"], section: "boardbags" },
  { keywords: ["surfpack", "surf pack", "backpack"], section: "surfpacks" },
  { keywords: ["leash", "leg rope", "legrope"], section: "leashes" },
  { keywords: ["apparel", "shirt", "tee", "t-shirt", "hoodie", "hat", "shorts", "trunks"], section: "apparel" },
]

function parseTags(tags: string): string[] {
  return tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

function tagSection(tags: string[]): PeerListingSection | null {
  for (const tag of tags) {
    const match = /^reswell:section:([a-z_]+)$/.exec(tag)
    if (match?.[1] && isPeerListingSectionValue(match[1])) {
      return match[1]
    }
  }
  return null
}

function mappingMatch(
  mappings: ShopifySectionMappingRow[],
  signalType: ShopifySectionSignalType,
  signalValue: string,
): PeerListingSection | null {
  const normalized = signalValue.trim().toLowerCase()
  const sorted = [...mappings]
    .filter((m) => m.signal_type === signalType)
    .sort((a, b) => a.priority - b.priority)

  for (const row of sorted) {
    if (row.signal_value.trim().toLowerCase() === normalized && isPeerListingSection(row.reswell_section)) {
      return row.reswell_section
    }
  }
  return null
}

function keywordSection(productType: string, title: string, tags: string[]): PeerListingSection | null {
  const haystack = [productType, title, ...tags].join(" ").toLowerCase()
  for (const rule of SECTION_KEYWORD_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.section
    }
  }
  return null
}

export function resolveShopifyProductSection(opts: {
  product: ShopifyRestProduct
  mappings: ShopifySectionMappingRow[]
  collectionTitles?: string[]
}): PeerListingSection | null {
  const tags = parseTags(opts.product.tags ?? "")

  const fromTag = tagSection(tags)
  if (fromTag) return fromTag

  for (const collection of opts.collectionTitles ?? []) {
    const fromCollection = mappingMatch(opts.mappings, "collection", collection)
    if (fromCollection) return fromCollection
  }

  const fromProductType = mappingMatch(opts.mappings, "product_type", opts.product.product_type ?? "")
  if (fromProductType) return fromProductType

  for (const tag of tags) {
    const fromTagMapping = mappingMatch(opts.mappings, "tag", tag)
    if (fromTagMapping) return fromTagMapping
  }

  return keywordSection(opts.product.product_type ?? "", opts.product.title ?? "", tags)
}

export function parseReswellTags(tags: string): Record<string, string> {
  const parsed: Record<string, string> = {}
  for (const raw of parseTags(tags)) {
    const match = /^reswell:([a-z_]+):(.+)$/.exec(raw)
    if (match) {
      parsed[match[1]] = match[2]
    }
  }
  return parsed
}
