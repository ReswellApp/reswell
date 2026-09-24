import "server-only"

import { generateText, NoObjectGeneratedError, Output } from "ai"
import { z } from "zod"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import {
  boardDimensionsFromScan,
  type SellBoardDimensionsScanFields,
} from "@/lib/sell-flow/sell-board-dimensions-scan"
import type { SellPhotoMatchMime } from "@/lib/sell-flow/sell-photo-match"

/**
 * Flat strings only. Nullable fields become JSON Schema anyOf, which the vision model rejects.
 * Empty string means "not readable".
 */
const scanModelSchema = z.object({
  lengthText: z.string(),
  widthText: z.string(),
  thicknessText: z.string(),
  volumeText: z.string(),
  unit: z.string(),
  rawText: z.string(),
})

const READ_FAILED =
  "Could not read a size on that photo. Try a closer, well-lit shot of the dimensions stamp."

const SYSTEM_PROMPT = `You read one close-up photo of a surfboard dimensions stamp, stringer label, or tail block for Reswell.

The stamp is usually length, then width, then thickness, sometimes with volume in liters. It may be one line, stacked, handwritten, or printed in both inches and centimeters.
Examples: 5'10" x 19 1/4" x 2 1/2" 32.5L; 6'2 x 19.25 x 2.38; 5-10 x 19 1/4 x 2 3/8; 178.0 x 49.5 x 6.0 cm / 28.4 L.

When both inches and centimeters are printed, report the inch measurements and set unit to "in".

lengthText: length in the unit you chose. Inches like 5'10. Centimeters like 178. Empty string if unreadable.
widthText: width as printed, like 19 1/4 or 49.5. Empty string if unreadable.
thicknessText: thickness as printed, like 2 1/2 or 6.0. Empty string if unreadable.
volumeText: liters only, like 32.5. Empty string if volume is not printed.
unit: "in", "cm", or "mm" for the numbers you reported. Empty string if you cannot tell.
rawText: the dimensions exactly as printed. Empty string if nothing is readable.

Only report numbers you can see. Do not guess a size from the board outline. Never use null. Never refuse.`

function scanFeature() {
  const feature = APP_LLM_FEATURES.find((item) => item.id === "sell_board_dimensions_scan")
  if (!feature) {
    throw new Error("sell_board_dimensions_scan is missing from APP_LLM_FEATURES")
  }
  return feature
}

export function isSellBoardDimensionsScanEnabled(): boolean {
  return isAppLlmFeatureEnabled(scanFeature())
}

export type SellBoardDimensionsScanImage = {
  bytes: Uint8Array
  mediaType: SellPhotoMatchMime
}

export type SellBoardDimensionsScanOutcome =
  | { ok: true; data: SellBoardDimensionsScanFields }
  | { ok: false; error: string; status: 422 | 503 }

function visionFailureDetail(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (!NoObjectGeneratedError.isInstance(err) || !err.text) return message
  return `${message} :: ${err.text.slice(0, 400)}`
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced?.[1]?.trim() || trimmed
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

function visionProviderOptions(model: string) {
  const google = model.startsWith("google/gemini-3")
    ? { thinkingConfig: { thinkingLevel: "low" } }
    : model.startsWith("google/gemini-2")
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : null
  return {
    ...(google ? { google } : {}),
    gateway: {
      tags: gatewayTagsForFeature("sell_board_dimensions_scan"),
    },
  }
}

export async function scanSellBoardDimensions(input: {
  photo: SellBoardDimensionsScanImage
}): Promise<SellBoardDimensionsScanOutcome> {
  if (!isSellBoardDimensionsScanEnabled()) {
    return { ok: false, error: "Dimension scanning is not configured.", status: 503 }
  }
  if (input.photo.bytes.byteLength < 1) {
    return { ok: false, error: "Take a photo of the dimensions stamp.", status: 422 }
  }

  const model = resolveConfiguredModel(scanFeature())
  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: "Read the surfboard dimensions in this photo. Use an empty string for any measurement you cannot see.",
        },
        {
          type: "file" as const,
          mediaType: input.photo.mediaType,
          data: input.photo.bytes,
        },
      ],
    },
  ]

  let raw: unknown = null
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: scanModelSchema }),
      system: SYSTEM_PROMPT,
      messages,
      temperature: 0,
      maxOutputTokens: 1024,
      maxRetries: 0,
      timeout: 20_000,
      providerOptions: visionProviderOptions(model),
    })
    raw = output
  } catch (err) {
    console.error("[sellBoardDimensionsScan] structured read failed:", visionFailureDetail(err))
  }

  if (!raw || typeof raw !== "object") {
    try {
      const { text } = await generateText({
        model,
        system: `${SYSTEM_PROMPT}\nReply with one JSON object and no other text.`,
        messages,
        temperature: 0,
        maxOutputTokens: 512,
        maxRetries: 0,
        timeout: 15_000,
        providerOptions: visionProviderOptions(model),
      })
      raw = parseJsonObject(text)
    } catch (err) {
      console.error("[sellBoardDimensionsScan] text read failed:", visionFailureDetail(err))
    }
  }

  const fields = boardDimensionsFromScan(
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {},
  )
  if (!fields) return { ok: false, error: READ_FAILED, status: 422 }
  return { ok: true, data: fields }
}
