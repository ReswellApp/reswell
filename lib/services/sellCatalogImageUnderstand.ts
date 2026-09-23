/**
 * Vision `/sell` catalog scan via the AI Gateway.
 *
 * Role: read a photo and extract brand/model/category. Retrieval stays
 * Elasticsearch / Supabase — the LLM never scans catalog rows.
 */

import "server-only"

import { generateText, Output } from "ai"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import {
  sellCatalogImageScanExtractSchema,
  type SellCatalogImageScanExtract,
} from "@/lib/validations/sellCatalogImageScan"
import { normalizeSellCatalogImageScanExtract } from "@/lib/utils/sell-catalog-image-scan"

function imageScanFeature() {
  const feature = APP_LLM_FEATURES.find((row) => row.id === "sell_catalog_image_scan")
  if (!feature) {
    throw new Error("sell_catalog_image_scan is missing from APP_LLM_FEATURES")
  }
  return feature
}

export function isSellCatalogImageScanEnabled(): boolean {
  return isAppLlmFeatureEnabled(imageScanFeature())
}

export type SellCatalogScanImageInput = {
  bytes: Uint8Array
  mediaType: "image/jpeg" | "image/png" | "image/webp"
}

async function callLlmForSellCatalogImage(
  image: SellCatalogScanImageInput,
): Promise<SellCatalogImageScanExtract | null> {
  try {
    const { output } = await generateText({
      model: resolveConfiguredModel(imageScanFeature()),
      output: Output.object({ schema: sellCatalogImageScanExtractSchema }),
      system: `You help Reswell admins identify a surfboard or fin from a photo so they can start a listing from our catalog.

Look only at what is visible. Read logos, stickers, foil stamps, and printed names.

Categories:
- "surfboards": longboards, shortboards, fish, mid-lengths, eggs, guns
- "fins": single fins, keels, side bites, FCS/Futures sets, glass-ons

Rules:
- brandText is the brand/shaper name only. modelText is the model/shape name only.
- Never invent a brand or model that is not readable or clearly marked on the item.
- If the photo is a generic unmarked board or fin, brandText and modelText must be null.
- Fix obvious brand spellings only when the logo/text is readable: "CI" → "Channel Islands"; "True Ames" stays "True Ames".
- Strip dimensions (9'6"), condition words, colors, and years out of brandText and modelText.
- visibleText lists short strings actually readable in the photo (logos, model names). Do not add guesses.
- productKind is "fin" for fin sets/keels even if a board is partly in frame. It is "other" for wetsuits, bags, or apparel.
- confidence is 0–1. Use below 0.45 when the brand or model is a guess from shape alone.
- summary is a short phrase like "Channel Islands Twin Pin" or "unmarked longboard".
- notes explains uncertainty, or null when the read is clear.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: image.bytes,
              mediaType: image.mediaType,
            },
            {
              type: "text",
              text: "Identify the surfboard or fin in this photo for our catalog match.",
            },
          ],
        },
      ],
      temperature: 0,
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("sell_catalog_image_scan"),
        },
      },
    })

    if (!output) return null
    return normalizeSellCatalogImageScanExtract(
      sellCatalogImageScanExtractSchema.parse(output),
    )
  } catch (err) {
    console.error("[sellCatalogImageUnderstand] vision parse failed:", err)
    return null
  }
}

export async function understandSellCatalogImage(
  image: SellCatalogScanImageInput,
): Promise<SellCatalogImageScanExtract | null> {
  if (!isSellCatalogImageScanEnabled()) return null
  return callLlmForSellCatalogImage(image)
}
