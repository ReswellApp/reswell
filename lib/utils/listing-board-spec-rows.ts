import {
  CONSTRUCTION_OPTIONS,
  FIN_SYSTEM_OPTIONS,
} from "@/lib/boards-browse-facets"
import {
  formatListingGeometryLine,
  formatListingVolumePart,
} from "@/lib/listing-dimensions-display"
import { FIN_SETUP_LABELS, parseFinsSetupFromStorage } from "@/lib/listing-fin-setup-tags"

export type ListingBoardSpecRow = {
  label: string
  value: string
  href?: string | null
}

export type ListingBoardSpecSource = {
  dimensions?: string | null
  construction?: string | null
  fin_system?: string | null
  fins_setup?: string | null
  fins_included?: boolean | null
}

const SKIP_SLUGS = new Set(["other"])

function labelForOption(
  options: readonly { value: string; label: string }[],
  slug: string | null | undefined,
): string | null {
  const value = slug?.trim() ?? ""
  if (!value || SKIP_SLUGS.has(value)) return null
  return options.find((o) => o.value === value)?.label ?? null
}

/**
 * Buy-column spec rows for surfboard `/l` pages.
 * Omits empty fields and generic `other` slugs so the table only shows facts a buyer can use.
 */
export function listingBoardSpecRows(input: ListingBoardSpecSource): ListingBoardSpecRow[] {
  const rows: ListingBoardSpecRow[] = []

  const geometry = formatListingGeometryLine({ dimensions: input.dimensions })
  if (geometry) rows.push({ label: "Dimensions", value: geometry })

  const volume = formatListingVolumePart({ dimensions: input.dimensions })
  if (volume) rows.push({ label: "Volume", value: volume })

  const construction = labelForOption(CONSTRUCTION_OPTIONS, input.construction)
  if (construction) rows.push({ label: "Construction", value: construction })

  const finSystem = labelForOption(FIN_SYSTEM_OPTIONS, input.fin_system)
  if (finSystem) rows.push({ label: "Fin system", value: finSystem })

  const setups = parseFinsSetupFromStorage(input.fins_setup).filter((slug) => !SKIP_SLUGS.has(slug))
  if (setups.length > 0) {
    rows.push({
      label: "Fin setup",
      value: setups.map((slug) => FIN_SETUP_LABELS[slug]).join(", "),
    })
  }

  if (input.fins_included === true) {
    rows.push({ label: "Fins included", value: "Included" })
  } else if (input.fins_included === false) {
    rows.push({ label: "Fins included", value: "Not included" })
  }

  return rows
}
