"use client"

import type { SellPhotoMatchResponse } from "@/lib/types/sell-photo-match"
import {
  sellCatalogSearchCategoryLabel,
  sellCatalogSearchRowCategory,
  sellCatalogSearchRowModelName,
  sellCatalogSearchRowTitle,
  type SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"

function rowMeta(row: SellCatalogSearchResultRow): string {
  const category = sellCatalogSearchCategoryLabel(sellCatalogSearchRowCategory(row))
  if (row.kind === "brand") return category
  if (row.kind === "model") return `${row.brandName} · ${category}`
  return `${row.brandName} · ${row.variantLabel || category}`
}

function confidenceLabel(confidence: SellPhotoMatchResponse["observation"]["confidence"]): string {
  if (confidence === "high") return "High confidence"
  if (confidence === "medium") return "Medium confidence"
  return "Low confidence"
}

export function SellPhotoIdentifyResults({
  result,
  onSelect,
}: {
  result: SellPhotoMatchResponse
  onSelect: (row: SellCatalogSearchResultRow) => void
}) {
  const readBits = [
    result.observation.brandText,
    result.observation.modelText,
    result.observation.lengthText,
    result.observation.widthText,
    result.observation.thicknessText,
  ].filter((part): part is string => Boolean(part))

  return (
    <div className="mt-2 space-y-3">
      <div>
        <p className="text-sm text-foreground">{result.observation.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {confidenceLabel(result.observation.confidence)}
          {readBits.length > 0 ? ` · ${readBits.join(" · ")}` : ""}
          {result.catalogBackend === "elasticsearch" ? " · Elasticsearch" : ""}
          {result.usedEmbedding ? " · Gemini Embedding" : ""}
          {result.catalogBackend === "supabase" ? " · Database fallback" : ""}
        </p>
      </div>

      {result.rows.length > 0 ? (
        <ul className="overflow-hidden rounded-xl border border-border bg-background">
          {result.rows.map((row) => {
            const title =
              row.kind === "model"
                ? sellCatalogSearchRowModelName(row) ?? sellCatalogSearchRowTitle(row)
                : sellCatalogSearchRowTitle(row)
            return (
              <li key={`${row.kind}-${row.id}`} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center px-4 py-2.5 text-left hover:bg-muted/70"
                  onClick={() => onSelect(row)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{rowMeta(row)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {result.lookupQuery
            ? `Nothing in the catalog matched “${result.lookupQuery}”. Search by name above, or try a closer photo.`
            : "No brand or model was readable. Retake the top or bottom so the logo is in frame."}
        </p>
      )}
    </div>
  )
}
