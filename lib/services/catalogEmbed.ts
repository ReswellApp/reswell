/**
 * Catalog vectors for photo match, through the Vercel AI Gateway.
 * Gemini Embedding 2 is the gateway's multimodal embedding model: a photo and
 * a catalog title land in the same vector space. Billed on the existing
 * gateway account. No separate embedding vendor key.
 */

import { embed, embedMany } from "ai"
import { gatewayEnvTag, gatewayTagsForFeature } from "@/lib/llm/app-models"

export const CATALOG_EMBED_MODEL = "google/gemini-embedding-2"
/**
 * Recommended Matryoshka size for Gemini Embedding 2.
 * Keep in sync with the sell-catalog index mapping.
 */
export const CATALOG_EMBED_DIMENSIONS = 1536

const TEXT_BATCH = 64

export function isCatalogEmbedConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim(),
  )
}

function isVector(value: number[]): boolean {
  return value.length === CATALOG_EMBED_DIMENSIONS && value.every((n) => Number.isFinite(n))
}

function assertVectors(vectors: number[][], expected: number): number[][] {
  if (vectors.length !== expected) {
    throw new Error("Catalog embed returned a different number of vectors than inputs")
  }
  for (const vector of vectors) {
    if (!isVector(vector)) {
      throw new Error(
        `Catalog embed returned a vector that is not ${CATALOG_EMBED_DIMENSIONS} dimensions`,
      )
    }
  }
  return vectors
}

/** Catalog titles embedded as retrieval documents. */
export async function embedCatalogDocuments(texts: readonly string[]): Promise<number[][]> {
  if (!isCatalogEmbedConfigured() || texts.length === 0) return []

  const out: number[][] = []
  for (let i = 0; i < texts.length; i += TEXT_BATCH) {
    const chunk = texts.slice(i, i + TEXT_BATCH)
    const { embeddings } = await embedMany({
      model: CATALOG_EMBED_MODEL,
      values: [...chunk],
      maxParallelCalls: 2,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(60_000),
      providerOptions: {
        google: {
          outputDimensionality: CATALOG_EMBED_DIMENSIONS,
          taskType: "RETRIEVAL_DOCUMENT",
        },
        gateway: {
          tags: ["feature:sell-catalog-embed", gatewayEnvTag(), "product:reswell"],
        },
      },
    })
    out.push(...assertVectors(embeddings, chunk.length))
  }
  return out
}

export type CatalogEmbedPhoto = {
  bytes: Uint8Array
  mediaType: string
}

const PHOTO_MIME = new Set(["image/jpeg", "image/png"])

/**
 * One retrieval-query vector for the board photos.
 * Gemini Embedding 2 accepts up to six JPEG or PNG images in one embedding.
 */
export async function embedCatalogPhotoQuery(input: {
  images: readonly CatalogEmbedPhoto[]
  text?: string | null
}): Promise<number[] | null> {
  if (!isCatalogEmbedConfigured()) return null

  const parts = input.images
    .filter((image) => image.bytes.byteLength > 0 && PHOTO_MIME.has(image.mediaType))
    .slice(0, 6)
    .map((image) => ({
      inlineData: {
        mimeType: image.mediaType,
        data: Buffer.from(image.bytes).toString("base64"),
      },
    }))
  if (parts.length === 0) return null

  const text = input.text?.trim()
  const { embedding } = await embed({
    model: CATALOG_EMBED_MODEL,
    value: text && text.length > 0 ? text.slice(0, 500) : "logo",
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(25_000),
    providerOptions: {
      google: {
        outputDimensionality: CATALOG_EMBED_DIMENSIONS,
        taskType: "RETRIEVAL_QUERY",
        content: [parts],
      },
      gateway: {
        tags: gatewayTagsForFeature("sell_photo_match"),
      },
    },
  })
  const [vector] = assertVectors([embedding], 1)
  return vector ?? null
}
