import { z } from "zod"
import {
  BOARD_STYLE_OPTIONS,
  CONDITION_OPTIONS,
  CONSTRUCTION_OPTIONS,
  FIN_SYSTEM_OPTIONS,
} from "@/lib/boards-browse-facets"

const styleValues = BOARD_STYLE_OPTIONS.map((o) => o.value) as [string, ...string[]]
const conditionValues = CONDITION_OPTIONS.map((o) => o.value) as [string, ...string[]]
const constructionValues = CONSTRUCTION_OPTIONS.map((o) => o.value) as [string, ...string[]]
const finSystemValues = FIN_SYSTEM_OPTIONS.map((o) => o.value) as [string, ...string[]]

/**
 * Structured NL search intent from Gemini (or another LLM).
 * Enums are locked to `/boards` facet slugs so output maps 1:1 to ES filters.
 */
export const marketplaceNlSearchIntentSchema = z.object({
  brandText: z
    .string()
    .nullable()
    .describe("Brand name if mentioned (e.g. Channel Islands, CI)"),
  modelText: z
    .string()
    .nullable()
    .describe("Board model name if mentioned (e.g. Dumpster Diver)"),
  residualText: z
    .string()
    .nullable()
    .describe("Keyword text left after extracting filters (brand/model/attrs removed)"),
  styles: z
    .array(z.enum(styleValues))
    .describe("Board styles / types mentioned"),
  conditions: z
    .array(z.enum(conditionValues))
    .describe("Listing conditions mentioned"),
  constructions: z
    .array(z.enum(constructionValues))
    .describe("Construction types if mentioned"),
  finSystems: z
    .array(z.enum(finSystemValues))
    .describe("Fin systems if mentioned"),
  lengthToken: z
    .string()
    .nullable()
    .describe("Board length like 5'10 or 6'2 if mentioned"),
  minPrice: z
    .number()
    .nullable()
    .describe("Minimum price in USD if mentioned"),
  maxPrice: z
    .number()
    .nullable()
    .describe("Maximum price in USD if mentioned (under/less than)"),
  locationText: z
    .string()
    .nullable()
    .describe("City, region, or area if mentioned"),
  shippingAvailable: z
    .boolean()
    .nullable()
    .describe("True if user wants shipping / ships / can ship"),
  summary: z
    .string()
    .describe("Short human summary of applied filters for the UI"),
})

export type MarketplaceNlSearchIntent = z.infer<typeof marketplaceNlSearchIntentSchema>
