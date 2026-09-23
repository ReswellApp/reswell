import { z } from "zod"

/**
 * Structured extract the `/sell` image scanner asks the vision model for.
 * Brand/model must come from what is visible — never invented.
 */
const emptyToNull = z
  .string()
  .nullable()
  .transform((value) => {
    const trimmed = value?.trim() ?? ""
    return trimmed.length > 0 ? trimmed : null
  })

export const sellCatalogImageScanExtractSchema = z.object({
  /** What the photo actually shows. */
  productKind: z.enum(["surfboard", "fin", "other", "unknown"]),
  /** Canonical brand name read from logos/text, or null when none is visible. */
  brandText: emptyToNull,
  /** Model/shape name without dimensions or condition words. */
  modelText: emptyToNull,
  /** Product category inferred from the photo, or null when unclear. */
  category: z.enum(["surfboards", "fins"]).nullable(),
  /** Logos, stickers, and printed names actually readable in the photo. */
  visibleText: z.array(z.string().trim().min(1)).max(12).default([]),
  /** Shape/setup hint such as "fish", "longboard", "keel", or null. */
  shapeHint: emptyToNull,
  /** Model self-score from 0–1 (values over 1 are treated as percent). */
  confidence: z.number(),
  /** Short human-readable interpretation, e.g. `Channel Islands Twin Pin`. */
  summary: z.string().trim().min(1).max(160),
  /** Why the read is uncertain, or null when confident. */
  notes: emptyToNull,
})

export type SellCatalogImageScanExtract = z.infer<
  typeof sellCatalogImageScanExtractSchema
>
