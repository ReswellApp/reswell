import "server-only"

import { generateText, NoObjectGeneratedError, Output } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import { matchSellPhotoToCatalog } from "@/lib/services/sellPhotoCatalogMatch"
import { embedCatalogPhotoQuery } from "@/lib/services/catalogEmbed"
import {
  coerceSellPhotoObservation,
  parseSellPhotoObservationJson,
  sellPhotoEmbeddingOnlyObservation,
  sellPhotoEmbeddingQueryText,
  type SellPhotoMatchMime,
} from "@/lib/sell-flow/sell-photo-match"
import type { SellPhotoMatchResponse } from "@/lib/types/sell-photo-match"

/**
 * Every field is a required string so Gemini structured output stays a flat
 * object. Nullable fields become JSON Schema anyOf, which the vision model rejects.
 * Empty string means "not readable". Coercion applies the strict schema afterward.
 */
const sellPhotoObservationModelSchema = z.object({
  category: z.string(),
  brandText: z.string(),
  modelText: z.string(),
  visibleText: z.array(z.string()).max(12),
  lengthText: z.string(),
  widthText: z.string(),
  thicknessText: z.string(),
  confidence: z.string(),
  summary: z.string(),
})

const READ_FAILED =
  "Could not read those photos. Try a closer shot of the logo and the dimensions label."

function photoMatchFeature() {
  const feature = APP_LLM_FEATURES.find((item) => item.id === "sell_photo_match")
  if (!feature) {
    throw new Error("sell_photo_match is missing from APP_LLM_FEATURES")
  }
  return feature
}

const FIELD_RULES = `Always return the object. Unreadable fields are empty strings. Never use null. Never refuse.

category: "surfboards" when the photos are a board. "unknown" when they are not.
brandText: canonical brand when the logo or name is readable. Normalize a visible mark: "CI" → "Channel Islands", "JS" → "JS Industries", "PV" → "Pacific Vibrations", "Mayhem" → "Lost", "HS" or "Hayden Shapes" → "Haydenshapes". Empty string when the brand is not readable.
modelText: model or shape name when it is readable (Twin Pin, RNF, Ghost, Happy Everyday). Empty string when it is not readable.
visibleText: short strings you can actually read (max 8), including the logo text exactly as printed. Skip the word surfboard.
lengthText: length when printed, such as 6'2. Otherwise empty string.
widthText: width in inches when printed, such as 19 1/4. Otherwise empty string.
thicknessText: thickness in inches when printed, such as 2 1/2. Otherwise empty string.
confidence: "high" only when brand and model are both clearly readable; "medium" when the brand is clear; "low" otherwise.
summary: one sentence of what you see, including what you could not read.

Do not invent a brand from the outline, color, or template of the board.`

const SYSTEM_PROMPT = `You identify one surfboard for Reswell's catalog from three photos of that same board:
1. Top — the deck
2. Bottom — the slick
3. Dimensions — a close-up of the size label, stringer stamp, or tail block

Read logos and model names from the deck and the bottom, including small logos near the nose, tail, or stringer. Read length, width, and thickness from the dimensions close-up. A stamp is often three measurements like 5'10 x 19 1/4 x 2 1/2, sometimes stacked or handwritten. Only report a brand, model, or measurement you can actually see.

${FIELD_RULES}`

const LISTING_SYSTEM_PROMPT = `You identify one surfboard from unlabeled photos on a live listing. The photos are not marked as top, bottom, or dimensions. Some may be lifestyle shots. Read a logo, model name, or size stamp from whichever photo shows it. A stamp is often three measurements like 5'10 x 19 1/4 x 2 1/2. Only report a brand, model, or measurement you can actually see.

${FIELD_RULES}`

export function isSellPhotoMatchEnabled(): boolean {
  return isAppLlmFeatureEnabled(photoMatchFeature())
}

export type SellPhotoMatchOutcome =
  | { ok: true; data: SellPhotoMatchResponse }
  | { ok: false; error: string; status: 422 | 503 }

export type SellPhotoMatchImage = {
  bytes: Uint8Array
  mediaType: SellPhotoMatchMime
}

const SHOT_PROMPTS = {
  top: "Photo 1 of 3 — TOP (deck). Read any logo or model name on this side, even if it is small.",
  bottom: "Photo 2 of 3 — BOTTOM. Read any logo, model name, or signature on this side.",
  dimensions:
    "Photo 3 of 3 — DIMENSIONS close-up. Read the printed or handwritten length, width, and thickness. Also read any brand or model on this label.",
} as const

function visionFailureDetail(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (!NoObjectGeneratedError.isInstance(err) || !err.text) return message
  return `${message} :: ${err.text.slice(0, 400)}`
}

function photoPart(shot: SellPhotoMatchImage) {
  return {
    type: "file" as const,
    mediaType: shot.mediaType,
    data: shot.bytes,
  }
}

function photoMessages(shots: {
  top: SellPhotoMatchImage
  bottom: SellPhotoMatchImage
  dimensions: SellPhotoMatchImage
}) {
  return [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: "These three photos are one surfboard. Use an empty string for any brand, model, or measurement you cannot read.",
        },
        { type: "text" as const, text: SHOT_PROMPTS.top },
        photoPart(shots.top),
        { type: "text" as const, text: SHOT_PROMPTS.bottom },
        photoPart(shots.bottom),
        { type: "text" as const, text: SHOT_PROMPTS.dimensions },
        photoPart(shots.dimensions),
      ],
    },
  ]
}

function listingPhotoMessages(images: readonly SellPhotoMatchImage[]) {
  const count = images.length
  return [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: `These ${count} photos are one surfboard from a live listing. They are not in a fixed order. Use an empty string for any brand, model, or measurement you cannot read.`,
        },
        ...images.flatMap((image, index) => [
          { type: "text" as const, text: `Photo ${index + 1} of ${count}.` },
          photoPart(image),
        ]),
      ],
    },
  ]
}

function visionProviderOptions(model: string, includeThinking: boolean) {
  const google = !includeThinking
    ? null
    : model.startsWith("google/gemini-3")
      ? { thinkingConfig: { thinkingLevel: "medium" } }
      : model.startsWith("google/gemini-2")
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : null
  return {
    ...(google ? { google } : {}),
    gateway: {
      tags: gatewayTagsForFeature("sell_photo_match"),
    },
  }
}

type PhotoMessage = ReturnType<typeof photoMessages>[number]

async function matchPreparedPhotos(input: {
  supabase: SupabaseClient
  system: string
  messages: PhotoMessage[]
  embedImages: readonly SellPhotoMatchImage[]
}): Promise<SellPhotoMatchOutcome> {
  if (!isSellPhotoMatchEnabled()) {
    return { ok: false, error: "Photo matching is not configured.", status: 503 }
  }

  const model = resolveConfiguredModel(photoMatchFeature())
  let raw: unknown = null
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: sellPhotoObservationModelSchema }),
      system: input.system,
      messages: input.messages,
      temperature: 0,
      maxOutputTokens: 4096,
      maxRetries: 0,
      timeout: 32_000,
      providerOptions: visionProviderOptions(model, true),
    })
    raw = output
  } catch (err) {
    console.error("[sellPhotoMatch] structured read failed:", visionFailureDetail(err))
  }

  if (!coerceSellPhotoObservation(raw)) {
    try {
      const { text } = await generateText({
        model,
        system: `${input.system}\nReply with one JSON object and no other text.`,
        messages: input.messages,
        temperature: 0,
        maxOutputTokens: 2048,
        maxRetries: 0,
        timeout: 20_000,
        providerOptions: visionProviderOptions(model, false),
      })
      raw = parseSellPhotoObservationJson(text)
    } catch (err) {
      console.error("[sellPhotoMatch] text read failed:", visionFailureDetail(err))
    }
  }

  let observation = coerceSellPhotoObservation(raw)
  const fromPhotosOnly = !observation
  const printedNameIsEnough = Boolean(
    observation?.brandText && observation.modelText && observation.confidence !== "low",
  )
  const vector = printedNameIsEnough
    ? null
    : await embedCatalogPhotoQuery({
        images: input.embedImages,
        text: observation ? sellPhotoEmbeddingQueryText(observation) : null,
      }).catch((err: unknown) => {
        console.error(
          "[sellPhotoMatch] embed failed:",
          err instanceof Error ? err.message : err,
        )
        return null
      })

  if (!observation) {
    if (!vector) return { ok: false, error: READ_FAILED, status: 422 }
    observation = sellPhotoEmbeddingOnlyObservation()
  }

  const catalog = await matchSellPhotoToCatalog(input.supabase, observation, vector)
  if (fromPhotosOnly && catalog.rows.length === 0) {
    return { ok: false, error: READ_FAILED, status: 422 }
  }
  return {
    ok: true,
    data: {
      observation,
      lookupQuery: catalog.lookupQuery,
      matchTier: catalog.matchTier,
      catalogBackend: catalog.backend,
      usedEmbedding: catalog.usedEmbedding,
      rows: catalog.rows,
    },
  }
}

export async function matchSellPhoto(input: {
  supabase: SupabaseClient
  shots: {
    top: SellPhotoMatchImage
    bottom: SellPhotoMatchImage
    dimensions: SellPhotoMatchImage
  }
}): Promise<SellPhotoMatchOutcome> {
  const shots = [input.shots.top, input.shots.bottom, input.shots.dimensions]
  if (shots.some((shot) => shot.bytes.byteLength < 1)) {
    return { ok: false, error: "Add the top, bottom, and dimensions photos.", status: 422 }
  }
  return matchPreparedPhotos({
    supabase: input.supabase,
    system: SYSTEM_PROMPT,
    messages: photoMessages(input.shots),
    embedImages: [input.shots.top, input.shots.bottom],
  })
}

/** Unlabeled photos from one live listing. The saved brand and model are not sent to the model. */
export async function matchSellListingPhotos(input: {
  supabase: SupabaseClient
  images: readonly SellPhotoMatchImage[]
}): Promise<SellPhotoMatchOutcome> {
  if (input.images.length < 1) {
    return { ok: false, error: "Choose at least one listing photo.", status: 422 }
  }
  if (input.images.some((image) => image.bytes.byteLength < 1)) {
    return { ok: false, error: "Choose at least one listing photo.", status: 422 }
  }
  return matchPreparedPhotos({
    supabase: input.supabase,
    system: LISTING_SYSTEM_PROMPT,
    messages: listingPhotoMessages(input.images),
    embedImages: input.images,
  })
}
