import type { FinCatalogSearchSelection } from "@/lib/types/fin-catalog-search"
import {
  isSellCatalogSearchCategory,
  sellCatalogSearchCategoryLabel,
  sellCatalogSearchRowCategory,
  type SellCatalogSearchCategory,
  type SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"
import { finCatalogSearchRowThumbUrl } from "@/lib/utils/fin-catalog-display-image"

/**
 * One-shot handoff from the `/sell` catalog search wall into a category sell
 * flow. Written right before navigating; the destination flow takes (reads and
 * clears) it on mount to prefill brand/model.
 */
const SELL_CATALOG_HANDOFF_KEY = "reswell.sell.catalogHandoffOnce"

export type SellCatalogHandoff =
  | {
      selectionKind: "brand"
      category: SellCatalogSearchCategory
      brandId: string
      brandName: string
      brandSlug: string
      suggestedTitle: string
      suggestedDescription: string | null
      /** Brand logo — shown on the destination form's catalog selection card. */
      imageUrl: string | null
      imageIsLogo: boolean
    }
  | {
      selectionKind: "model"
      category: SellCatalogSearchCategory
      brandId: string
      brandName: string
      brandSlug: string
      brandModelId: string
      modelName: string
      suggestedTitle: string
      suggestedDescription: string | null
      /** Model photo (falls back to brand logo) for the catalog selection card. */
      imageUrl: string | null
      imageIsLogo: boolean
      /** Surfboard shape key — auto-selects the boards "Board shape / category" chip. */
      boardCategorySlug: string | null
    }
  | ({
      selectionKind: "variant"
      category: "fins"
      brandSlug: string
      /** Variant / model photo (falls back to brand logo) for the catalog selection card. */
      imageUrl: string | null
      imageIsLogo: boolean
    } & Extract<FinCatalogSearchSelection, { kind: "variant" }>)

export function sellCatalogHandoffFromRow(row: SellCatalogSearchResultRow): SellCatalogHandoff {
  const category = sellCatalogSearchRowCategory(row)

  if (row.kind === "brand") {
    return {
      selectionKind: "brand",
      category,
      brandId: row.id,
      brandName: row.name,
      brandSlug: row.slug,
      suggestedTitle: row.name,
      suggestedDescription: row.shortDescription,
      imageUrl: row.logoUrl?.trim() || null,
      imageIsLogo: true,
    }
  }

  if (row.kind === "model") {
    const modelImage = row.imageUrl?.trim() || null
    const brandLogo = row.brandLogoUrl?.trim() || null
    return {
      selectionKind: "model",
      category,
      brandId: row.brandId,
      brandName: row.brandName,
      brandSlug: row.brandSlug,
      brandModelId: row.id,
      modelName: row.name,
      suggestedTitle: `${row.brandName} ${row.name}`.trim(),
      suggestedDescription: row.description,
      imageUrl: modelImage ?? brandLogo,
      imageIsLogo: !modelImage && Boolean(brandLogo),
      boardCategorySlug: row.boardCategorySlug ?? null,
    }
  }

  const variantThumb = finCatalogSearchRowThumbUrl({
    kind: "variant",
    imageUrl: row.imageUrl,
    modelImageUrl: row.modelImageUrl,
    brandLogoUrl: row.brandLogoUrl,
  })
  const brandLogo = row.brandLogoUrl?.trim() || null

  return {
    selectionKind: "variant",
    category: "fins",
    kind: "variant",
    brandId: row.brandId,
    brandName: row.brandName,
    brandSlug: row.brandSlug,
    brandModelId: row.brandModelId,
    modelName: row.modelName,
    finSetup: row.finSetup,
    finSystem: row.finSystem,
    finSize: row.finSize,
    suggestedTitle: row.suggestedTitle,
    suggestedDescription: row.modelDescription,
    imageUrl: variantThumb,
    imageIsLogo: Boolean(variantThumb && brandLogo && variantThumb === brandLogo),
  }
}

/** Catalog-match card payload for the destination sell form. */
export function sellCatalogHandoffToSelectionCard(handoff: SellCatalogHandoff): {
  brandName: string
  modelName: string | null
  categoryLabel: string
  imageUrl: string | null
  imageIsLogo: boolean
} {
  return {
    brandName: handoff.brandName,
    modelName: handoff.selectionKind === "brand" ? null : handoff.modelName,
    categoryLabel: sellCatalogSearchCategoryLabel(handoff.category),
    imageUrl: handoff.imageUrl,
    imageIsLogo: handoff.imageIsLogo,
  }
}

export function writeSellCatalogHandoff(handoff: SellCatalogHandoff): void {
  try {
    sessionStorage.setItem(SELL_CATALOG_HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    /* quota / private mode — flow still opens, just without prefill */
  }
}

function parseHandoff(raw: string | null): SellCatalogHandoff | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null) return null
    const v = value as Record<string, unknown>
    const selectionKind = v.selectionKind
    if (
      typeof v.category !== "string" ||
      !isSellCatalogSearchCategory(v.category) ||
      typeof v.brandId !== "string" ||
      typeof v.brandName !== "string" ||
      typeof v.brandSlug !== "string"
    ) {
      return null
    }

    if (selectionKind === "brand") {
      if (typeof v.suggestedTitle !== "string") return null
      return {
        selectionKind: "brand",
        category: v.category,
        brandId: v.brandId,
        brandName: v.brandName,
        brandSlug: v.brandSlug,
        suggestedTitle: v.suggestedTitle,
        suggestedDescription:
          typeof v.suggestedDescription === "string" ? v.suggestedDescription : null,
        imageUrl: typeof v.imageUrl === "string" && v.imageUrl ? v.imageUrl : null,
        imageIsLogo: v.imageIsLogo === true,
      }
    }

    if (selectionKind === "model") {
      if (
        typeof v.brandModelId !== "string" ||
        typeof v.modelName !== "string" ||
        typeof v.suggestedTitle !== "string"
      ) {
        return null
      }
      return {
        selectionKind: "model",
        category: v.category,
        brandId: v.brandId,
        brandName: v.brandName,
        brandSlug: v.brandSlug,
        brandModelId: v.brandModelId,
        modelName: v.modelName,
        suggestedTitle: v.suggestedTitle,
        suggestedDescription:
          typeof v.suggestedDescription === "string" ? v.suggestedDescription : null,
        imageUrl: typeof v.imageUrl === "string" && v.imageUrl ? v.imageUrl : null,
        imageIsLogo: v.imageIsLogo === true,
        boardCategorySlug:
          typeof v.boardCategorySlug === "string" && v.boardCategorySlug
            ? v.boardCategorySlug
            : null,
      }
    }

    if (selectionKind === "variant" && v.category === "fins") {
      if (
        typeof v.brandModelId !== "string" ||
        typeof v.modelName !== "string" ||
        typeof v.finSetup !== "string" ||
        typeof v.finSystem !== "string" ||
        typeof v.suggestedTitle !== "string"
      ) {
        return null
      }
      return {
        selectionKind: "variant",
        category: "fins",
        kind: "variant",
        brandId: v.brandId,
        brandName: v.brandName,
        brandSlug: v.brandSlug,
        brandModelId: v.brandModelId,
        modelName: v.modelName,
        finSetup: v.finSetup,
        finSystem: v.finSystem,
        finSize: typeof v.finSize === "string" ? v.finSize : null,
        suggestedTitle: v.suggestedTitle,
        suggestedDescription:
          typeof v.suggestedDescription === "string" ? v.suggestedDescription : null,
        imageUrl: typeof v.imageUrl === "string" && v.imageUrl ? v.imageUrl : null,
        imageIsLogo: v.imageIsLogo === true,
      }
    }

    return null
  } catch {
    return null
  }
}

/** Read and clear the pending handoff if it targets the given category. */
export function takeSellCatalogHandoff(
  category: SellCatalogSearchCategory,
): SellCatalogHandoff | null {
  if (typeof window === "undefined") return null
  try {
    const handoff = parseHandoff(sessionStorage.getItem(SELL_CATALOG_HANDOFF_KEY))
    if (!handoff || handoff.category !== category) return null
    sessionStorage.removeItem(SELL_CATALOG_HANDOFF_KEY)
    return handoff
  } catch {
    return null
  }
}

export function sellCatalogHandoffToFinSelection(
  handoff: SellCatalogHandoff,
): FinCatalogSearchSelection | null {
  if (handoff.category !== "fins") return null
  if (handoff.selectionKind === "brand") {
    return {
      kind: "brand",
      brandId: handoff.brandId,
      brandName: handoff.brandName,
      suggestedTitle: handoff.suggestedTitle,
      suggestedDescription: handoff.suggestedDescription,
    }
  }
  if (handoff.selectionKind === "model") {
    return {
      kind: "model",
      brandId: handoff.brandId,
      brandName: handoff.brandName,
      brandModelId: handoff.brandModelId,
      modelName: handoff.modelName,
      suggestedTitle: handoff.suggestedTitle,
      suggestedDescription: handoff.suggestedDescription,
    }
  }
  return handoff
}
