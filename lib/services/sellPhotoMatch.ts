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
  widthText: z.string().nullable().optional(),
  thicknessText: z.string().nullable().optional(),
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

const SYSTEM_PROMPT = `You identify one surfboard for Reswell's catalog from three photos of that same board:
1. Top — the deck
2. Bottom — the slick
3. Dimensions — a close-up of the size label, stringer stamp, or tail block

Read logos and model names from the deck and the bottom. Read length, width, and thickness from the dimensions close-up. Only report a brand, model, or measurement you can actually see.

category: "surfboards" when the photos are a board. "unknown" when they are not.
brandText: canonical brand when the logo or name is readable. You may normalize a visible mark: "CI" → "Channel Islands", "JS" → "JS Industries", "Lost" stays "Lost". Use null when the brand is not readable.
modelText: model or shape name when it is readable (Twin Pin, RNF, Ghost). Use null when it is not readable.
visibleText: short strings you can actually read (max 8). Skip the word surfboard.
lengthText: length when printed, such as 6'2. Otherwise null.
widthText: width in inches when printed, such as 19 1/4. Otherwise null.
thicknessText: thickness in inches when printed, such as 2 1/2. Otherwise null.
confidence: "high" only when brand and model are both clearly readable; "medium" when the brand is clear; "low" otherwise.
summary: one sentence of what you see, including what you could not read.

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

export type SellPhotoMatchImage = {
  bytes: Uint8Array
  mediaType: SellPhotoMatchMime
}

const SHOT_PROMPTS = {
  top: "Photo 1 of 3 — TOP (deck). Read any logo or model name on this side.",
  bottom: "Photo 2 of 3 — BOTTOM. Read any logo, model name, or signature on this side.",
  dimensions:
    "Photo 3 of 3 — DIMENSIONS close-up. Read the printed length, width, and thickness. Also read any brand or model on this label.",
} as const

export async function matchSellPhoto(input: {
  supabase: SupabaseClient
  shots: {
    top: SellPhotoMatchImage
    bottom: SellPhotoMatchImage
    dimensions: SellPhotoMatchImage
  }
}): Promise<SellPhotoMatchOutcome> {
  if (!isSellPhotoMatchEnabled()) {
    return { ok: false, error: "Photo matching is not configured.", status: 503 }
  }
  const shots = [input.shots.top, input.shots.bottom, input.shots.dimensions]
  if (shots.some((shot) => shot.bytes.byteLength < 1)) {
    return { ok: false, error: "Add the top, bottom, and dimensions photos.", status: 422 }
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
              text: "These three photos are one surfboard. Leave brandText and modelText null unless you can read them.",
            },
            { type: "text", text: SHOT_PROMPTS.top },
            { type: "file", mediaType: input.shots.top.mediaType, data: input.shots.top.bytes },
            { type: "text", text: SHOT_PROMPTS.bottom },
            {
              type: "file",
              mediaType: input.shots.bottom.mediaType,
              data: input.shots.bottom.bytes,
            },
            { type: "text", text: SHOT_PROMPTS.dimensions },
            {
              type: "file",
              mediaType: input.shots.dimensions.mediaType,
              data: input.shots.dimensions.bytes,
            },
          ],
        },
      ],
      temperature: 0,
      maxOutputTokens: 600,
      maxRetries: 1,
      timeout: 50_000,
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
      error: "Could not read those photos. Try a closer shot of the logo and the dimensions label.",
      status: 422,
    }
  }

  const observation = coerceSellPhotoObservation(raw)
  if (!observation) {
    return {
      ok: false,
      error: "Could not read those photos. Try a closer shot of the logo and the dimensions label.",
      status: 422,
    }
  }

  const categories = sellPhotoMatchSearchCategories()
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
