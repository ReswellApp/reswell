import Anthropic, { APIError, AuthenticationError } from "@anthropic-ai/sdk"
import {
  isBoardLengthEntryComplete,
  normalizeBoardLengthInput,
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
} from "@/lib/board-measurements"
import {
  normalizeInchesForAccuracy,
  normalizeVolumeForAccuracy,
  reconcileDimsForAccuracy,
} from "@/lib/services/boardDimsStickerAccuracy"
import {
  scanBoardDimsModelOutputSchema,
  type ScanBoardDimsModelOutput,
  type ScanBoardDimsNormalized,
} from "@/lib/validations/scan-board-dims"

/** Soft gate before accuracy reconcile; transcript agreement is the real check. */
const MIN_FIELD_CONFIDENCE = 0.7
/** Max decoded image bytes accepted by the service (after client compress). */
export const SCAN_BOARD_DIMS_MAX_BYTES = 1_500_000

const ANTHROPIC_KEY_REJECTED =
  "Anthropic rejected your API key (invalid x-api-key). In .env.local use ANTHROPIC_API_KEY=sk-ant-... on a single line with no quotes or spaces."

function normalizeAnthropicApiKey(raw: string): string {
  let k = raw.trim()
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim()
  }
  return k
}

function userFacingAnthropicError(err: unknown): string {
  if (err instanceof AuthenticationError) return ANTHROPIC_KEY_REJECTED
  if (err instanceof APIError && err.status === 401) return ANTHROPIC_KEY_REJECTED
  if (err instanceof APIError) {
    return err.message.length < 280
      ? err.message
      : "Couldn’t read the sticker. Try again or enter dimensions manually."
  }
  return err instanceof Error
    ? err.message
    : "Couldn’t read the sticker. Try again or enter dimensions manually."
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fence ? fence[1] : trimmed).trim()
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new Error("Model did not return JSON")
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown
}

function confidenceOk(
  confidence: ScanBoardDimsModelOutput["confidence"],
  key: keyof NonNullable<ScanBoardDimsModelOutput["confidence"]>,
): boolean {
  const value = confidence?.[key]
  if (value == null) return true
  return value >= MIN_FIELD_CONFIDENCE
}

function normalizeLengthForForm(raw: string | null): string | null {
  if (!raw?.trim()) return null
  let t = raw.trim()
  t = t.replace(/\s*[Ll]\s*$/, "")
  t = t.replace(/["″”]/g, "")
  t = t.replace(/[′’]/g, "'")
  // "5 9" / "5-9" → 5'9
  if (!t.includes("'")) {
    const spaced = t.match(/^(\d{1,2})\s+(\d{1,2}(?:\s+\d+\/\d+)?|\d+\/\d+)$/)
    if (spaced) t = `${spaced[1]}'${spaced[2]}`
    else {
      const dashed = t.match(/^(\d{1,2})-(\d{1,2})$/)
      if (dashed) t = `${dashed[1]}'${dashed[2]}`
    }
  }
  const normalized = normalizeBoardLengthInput(t)
  if (!isBoardLengthEntryComplete(normalized)) return null
  const { feetStr, inchesStr } = parseBoardLengthParts(normalized)
  const ft = parseLengthFeet(feetStr)
  if (ft == null || ft < 1 || ft > 15) return null
  const inches =
    parseBoardMeasurement(inchesStr.trim()) ?? Number.parseFloat(inchesStr.trim())
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return null
  return normalized
}

/**
 * Map model JSON through accuracy reconcile: sticker transcript wins; structured
 * fields that disagree with rawText are dropped (blank > wrong).
 */
export function normalizeScanBoardDimsModelOutput(
  raw: ScanBoardDimsModelOutput,
): ScanBoardDimsNormalized {
  const conf = raw.confidence
  const rawText = raw.rawText?.trim() || undefined

  const structured = {
    length: confidenceOk(conf, "length") ? normalizeLengthForForm(raw.length) : null,
    widthInches: confidenceOk(conf, "widthInches")
      ? normalizeInchesForAccuracy(raw.widthInches)
      : null,
    thicknessInches: confidenceOk(conf, "thicknessInches")
      ? normalizeInchesForAccuracy(raw.thicknessInches)
      : null,
    volumeL: confidenceOk(conf, "volumeL")
      ? normalizeVolumeForAccuracy(raw.volumeL)
      : null,
  }

  const reconciled = reconcileDimsForAccuracy({ rawText, structured })

  const fieldCount = [
    reconciled.length,
    reconciled.widthInches,
    reconciled.thicknessInches,
    reconciled.volumeL,
  ].filter((v) => v != null && v !== "").length

  return {
    boardLength: reconciled.length,
    boardWidthInches: reconciled.widthInches,
    boardThicknessInches: reconciled.thicknessInches,
    boardVolumeL: reconciled.volumeL,
    fieldCount,
    rawText,
  }
}

export type ScanBoardDimensionsResult =
  | { ok: true; data: ScanBoardDimsNormalized }
  | { ok: false; error: string; status: number }

const SCAN_PROMPT = `You read surfboard dimension stickers (often handwritten on a black label).

Step 1: Transcribe the dimension line into rawText EXACTLY as written (keep / for fractions, decimals as decimals).
Example: 6'4" 19 3/8" 2 5/8" 38.4L

Step 2: Parse fields FROM rawText only — never invent or “fix” fractions.
- length: e.g. "6'4"
- widthInches: e.g. "19 3/8" or "18.25" — EXACTLY as in rawText
- thicknessInches: e.g. "2 5/8" — EXACTLY as in rawText
- volumeL: e.g. "38.4" (no L)

Critical: do not confuse 3/8 with 1/2 or 1/4. Read each digit carefully.
If unclear, null that field. Never guess.

Respond with ONLY JSON:
{"rawText":string,"length":string|null,"widthInches":string|null,"thicknessInches":string|null,"volumeL":string|null,"confidence":{"length":number,"widthInches":number,"thicknessInches":number,"volumeL":number}}`

export async function scanBoardDimensionsFromImage(input: {
  imageBase64: string
  mediaType: "image/jpeg" | "image/png" | "image/webp"
}): Promise<ScanBoardDimensionsResult> {
  const apiKey = normalizeAnthropicApiKey(process.env.ANTHROPIC_API_KEY ?? "")
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error:
        "Sticker scan is not configured. Add ANTHROPIC_API_KEY, or enter dimensions manually.",
    }
  }

  // Rough decoded size check (base64 expands ~4/3)
  const approxBytes = Math.floor((input.imageBase64.length * 3) / 4)
  if (approxBytes > SCAN_BOARD_DIMS_MAX_BYTES) {
    return {
      ok: false,
      status: 400,
      error: "Image is too large. Take a closer photo of the sticker and try again.",
    }
  }

  const client = new Anthropic({ apiKey })
  const started = Date.now()

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: input.mediaType,
                data: input.imageBase64,
              },
            },
            { type: "text", text: SCAN_PROMPT },
          ],
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    const text = textBlock && textBlock.type === "text" ? textBlock.text : ""
    if (!text.trim()) {
      console.info("[scan-board-dims] empty model text", {
        latencyMs: Date.now() - started,
      })
      return {
        ok: false,
        status: 422,
        error: "Couldn’t read the sticker. Try a sharper close-up, or enter dimensions manually.",
      }
    }

    let parsedUnknown: unknown
    try {
      parsedUnknown = extractJsonObject(text)
    } catch {
      console.info("[scan-board-dims] json parse failed", {
        latencyMs: Date.now() - started,
      })
      return {
        ok: false,
        status: 422,
        error: "Couldn’t read the sticker. Try a sharper close-up, or enter dimensions manually.",
      }
    }

    const modelParsed = scanBoardDimsModelOutputSchema.safeParse(parsedUnknown)
    if (!modelParsed.success) {
      console.info("[scan-board-dims] schema failed", {
        latencyMs: Date.now() - started,
      })
      return {
        ok: false,
        status: 422,
        error: "Couldn’t read the sticker. Try a sharper close-up, or enter dimensions manually.",
      }
    }

    const normalized = normalizeScanBoardDimsModelOutput(modelParsed.data)
    console.info("[scan-board-dims] ok", {
      latencyMs: Date.now() - started,
      fieldCount: normalized.fieldCount,
    })

    if (normalized.fieldCount === 0) {
      return {
        ok: false,
        status: 422,
        error:
          "Couldn’t find clear length, width, thickness, or volume. Fill them in manually.",
      }
    }

    return { ok: true, data: normalized }
  } catch (err) {
    console.info("[scan-board-dims] anthropic error", {
      latencyMs: Date.now() - started,
    })
    const status = err instanceof APIError ? err.status : 502
    return {
      ok: false,
      status: status === 401 ? 503 : 502,
      error: userFacingAnthropicError(err),
    }
  }
}
