import {
  brandModelVariantMaterialSchema,
  finBoxTypeSchema,
  finBoxesSchema,
  type BrandModelVariantMaterial,
  type FinBoxesType,
  type FinBoxType,
} from "@/lib/validations/brand-model-variants"
import { parseFinsSetupFromStorage } from "@/lib/listing-fin-setup-tags"

/**
 * The catalog variant vocab is now 1:1 with the listing facets (see the
 * brand_model_variants facet-vocab migration), so mapping a listing facet onto a
 * catalog variant value is a validation/normalization step rather than a translation.
 */

/**
 * Best-effort fin system guess from `listings.fins_setup` (fin layout). Prefer
 * {@link finBoxTypeFromListingFinSystem} when `listings.fin_system` is set; this is
 * only a fallback for legacy rows with no `fin_system`.
 */
export function finBoxTypeFromListingFinsSetup(raw: string | null | undefined): FinBoxType {
  const t = (raw ?? "").trim().toLowerCase()
  if (t.includes("fcs")) return "fcs_ii"
  if (t.includes("single")) return "single"
  return "futures"
}

/** Normalize listing `fin_system` to a catalog variant fin system value. */
export function finBoxTypeFromListingFinSystem(raw: string | null | undefined): FinBoxType {
  const parsed = finBoxTypeSchema.safeParse((raw ?? "").trim().toLowerCase())
  return parsed.success ? parsed.data : "futures"
}

/**
 * Normalize listing `fins_setup` to a catalog variant fin setup value.
 * Returns `null` when nothing maps so callers can fall back to a default.
 */
export function finBoxesLayoutFromListingFinsSetup(
  raw: string | null | undefined,
): FinBoxesType | null {
  for (const slug of parseFinsSetupFromStorage(raw)) {
    const parsed = finBoxesSchema.safeParse(slug)
    if (parsed.success) return parsed.data
  }
  return null
}

/**
 * Normalize listing `construction` to a catalog variant construction value.
 * Returns `null` when nothing maps so callers can fall back to a default.
 */
export function variantMaterialFromListingConstruction(
  raw: string | null | undefined,
): BrandModelVariantMaterial | null {
  const parsed = brandModelVariantMaterialSchema.safeParse((raw ?? "").trim().toLowerCase())
  return parsed.success ? parsed.data : null
}
