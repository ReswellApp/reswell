import "server-only"

import { generateText, Output } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import { searchSellCatalogForSell } from "@/lib/services/sellCatalogSearch"
import {
  coerceSellPhotoObservation,
  sellPhotoMatchLookupQuery,
  sellPhotoMatchSearchCategories,
  type SellPhotoMatchMime,
} from "@/lib/sell-flow/sell-photo-match"
import type { SellPhotoMatchResponse } from "@/lib/types/sell-photo-match"
import type { SellCatalogSearchResultRow } from "@/lib/types/sell-catalog-search"

/** Loose model output. Coercion applies the strict observation schema afterward. */
const sellPhotoObservationModelSchema = z.object({
  category: z.string().optional(),
  brandText: z.string().nullable().optional(),
  modelText: z.string().nullable().optional(),
  visibleText: z.array(z.string()).max(12).optional(),
  lengthText: z.string().nullable().optional(),
  confidence: z.string().optional(),
  summary: z.string().optional(),
})

const MAX_ROWS = 8

function photoMatchFeature() {
  const feature = APP_LLM_FEATURES.find((item) => item.id === "sell_photo_match")
  if (!feature) {
    throw new Error("sell_photo_match is missing from APP_LLM_FEATURES")
  }
  return feature
}

const SYSTEM_PROMPT = `You identify a surfboard or surfboard fin from one seller photo for Reswell's catalog.

Read logos, deck graphics, printed model names, dimensions, and fin-box branding. Only report a brand or model you can actually see.

category:
- "surfboards": a board (shortboard, fish, longboard, log, gun, mid-length, softboard)
- "fins": a fin, fin set, or fin packaging (FCS, Futures, glass-on, keels, side bites)
- "unknown": you cannot tell which

brandText: canonical brand when the logo or name is readable. Examples of normalization you may apply only when the mark is visible: "CI" → "Channel Islands", "JS" → "JS Industries", "FCS II" → "FCS". Use null when the brand is not readable.
modelText: model or shape name when it is readable (Twin Pin, RNF, Performer). Use null when it is not readable.
visibleText: short strings you can actually read (max 8). Skip the words surfboard and fin.
lengthText: board length when printed, such as 6'2. Otherwise null.
confidence: "high" only when brand and model are both clearly readable; "medium" when the brand or a shape family is clear; "low" otherwise.
summary: one sentence describing what you see, including what you could not read.

Do not invent a brand from the outline, color, or template of the board.`

export function isSellPhotoMatchEnabled(): boolean {
  return isAppLlmFeatureEnabled(photoMatchFeature())
}

export type SellPhotoMatchOutcome =
  | { ok: true; data: SellPhotoMatchResponse }
  | { ok: false; error: string; status: 422 | 503 }

function rankedRows(
  results: SellCatalogSearchResultRow[],
  similarResults: SellCatalogSearchResultRow[],
): { rows: SellCatalogSearchResultRow[]; matchTier: SellPhotoMatchResponse["matchTier"] } {
  if (results.length > 0) return { rows: results.slice(0, MAX_ROWS), matchTier: "exact" }
  if (similarResults.length > 0) {
    return { rows: similarResults.slice(0, MAX_ROWS), matchTier: "similar" }
  }
  return { rows: [], matchTier: "none" }
}

async function searchCatalog(
  supabase: SupabaseClient,
  query: string,
  categories: ReturnType<typeof sellPhotoMatchSearchCategories>,
): Promise<{ rows: SellCatalogSearchResultRow[]; matchTier: SellPhotoMatchResponse["matchTier"] }> {
  const result = await searchSellCatalogForSell(supabase, query, { categories })
  return rankedRows(result.results, result.similarResults)
}

export async function matchSellPhoto(input: {
  supabase: SupabaseClient
  bytes: Uint8Array
  mediaType: SellPhotoMatchMime
}): Promise<SellPhotoMatchOutcome> {
  if (!isSellPhotoMatchEnabled()) {
    return { ok: false, error: "Photo matching is not configured.", status: 503 }
  }
  if (input.bytes.byteLength < 1) {
    return { ok: false, error: "Choose a photo to scan.", status: 422 }
  }

  let raw: unknown
  try {
    const { output } = await generateText({
      model: resolveConfiguredModel(photoMatchFeature()),
      output: Output.object({ schema: sellPhotoObservationModelSchema }),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Identify the surfboard or fin in this photo. Leave brandText and modelText null unless you can read them.",
            },
            {
              type: "file",
              mediaType: input.mediaType,
              data: input.bytes,
            },
          ],
        },
      ],
      temperature: 0,
      maxOutputTokens: 500,
      maxRetries: 1,
      timeout: 45_000,
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("sell_photo_match"),
        },
      },
    })
    raw = output
  } catch (err) {
    console.error("[sellPhotoMatch] vision failed:", err instanceof Error ? err.message : err)
    return {
      ok: false,
      error: "Could not read that photo. Try a closer shot of the logo or model name.",
      status: 422,
    }
  }

  const observation = coerceSellPhotoObservation(raw)
  if (!observation) {
    return {
      ok: false,
      error: "Could not read that photo. Try a closer shot of the logo or model name.",
      status: 422,
    }
  }

  const categories = sellPhotoMatchSearchCategories(observation.category)
  const primary = sellPhotoMatchLookupQuery(observation)
  if (!primary) {
    return {
      ok: true,
      data: { observation, lookupQuery: null, matchTier: "none", rows: [] },
    }
  }

  const first = await searchCatalog(input.supabase, primary, categories)
  if (first.rows.length > 0) {
    return {
      ok: true,
      data: { observation, lookupQuery: primary, matchTier: first.matchTier, rows: first.rows },
    }
  }

  const brandOnly = observation.brandText?.trim() ?? ""
  const modelOnly = observation.modelText?.trim() ?? ""
  if (brandOnly.length >= 2 && modelOnly.length >= 2) {
    const brandSearch = await searchCatalog(input.supabase, brandOnly, categories)
    if (brandSearch.rows.length > 0) {
      return {
        ok: true,
        data: {
          observation,
          lookupQuery: brandOnly,
          matchTier: brandSearch.matchTier,
          rows: brandSearch.rows,
        },
      }
    }
  }

  if (modelOnly.length >= 2 && modelOnly.toLowerCase() !== primary.toLowerCase()) {
    const modelSearch = await searchCatalog(input.supabase, modelOnly, categories)
    if (modelSearch.rows.length > 0) {
      return {
        ok: true,
        data: {
          observation,
          lookupQuery: modelOnly,
          matchTier: modelSearch.matchTier,
          rows: modelSearch.rows,
        },
      }
    }
  }

  return {
    ok: true,
    data: { observation, lookupQuery: primary, matchTier: "none", rows: [] },
  }
}
