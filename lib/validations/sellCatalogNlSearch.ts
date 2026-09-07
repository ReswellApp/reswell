import { z } from "zod"
import { SELL_CATALOG_SEARCH_CATEGORIES } from "@/lib/types/sell-catalog-search"

/**
 * Structured intent the `/sell` catalog AI helper extracts from a seller's
 * free-text search (e.g. `gato heiro 9'6 dagger great condition` →
 * brand "Gato Heroi", model "Dagger", category "surfboards").
 *
 * Dedicated to the sell flow — independent from the marketplace
 * (`/boards`) NL search schema.
 */
export const sellCatalogNlSearchIntentSchema = z.object({
  /** Canonical brand name the seller referenced, or null when none was named. */
  brandText: z.string().nullable(),
  /** Model/shape name without dimensions, condition, or color words. */
  modelText: z.string().nullable(),
  /** Product category inferred from context, or null when ambiguous. */
  category: z.enum(SELL_CATALOG_SEARCH_CATEGORIES).nullable(),
  /** Short human-readable interpretation, e.g. `Gato Heroi Dagger surfboard`. */
  summary: z.string(),
})

export type SellCatalogNlSearchIntent = z.infer<typeof sellCatalogNlSearchIntentSchema>
