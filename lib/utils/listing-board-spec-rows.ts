import { accessorySizeLabel } from "@/lib/accessory-listing-config"
import { apparelKindLabel, apparelSizeLabel } from "@/lib/apparel-listing-config"
import { boardbagSizeLabel } from "@/lib/boardbag-listing-config"
import {
  BOARD_STYLE_OPTIONS,
  CONSTRUCTION_OPTIONS,
  FIN_SYSTEM_OPTIONS,
} from "@/lib/boards-browse-facets"
import { finSizeLabel, finSystemLabel } from "@/lib/fin-listing-config"
import { leashSizeLabel } from "@/lib/leash-listing-config"
import {
  formatListingGeometryLine,
  formatListingVolumePart,
} from "@/lib/listing-dimensions-display"
import { FIN_SETUP_LABELS, parseFinsSetupFromStorage } from "@/lib/listing-fin-setup-tags"
import { formatHomePeerListingConditionLine } from "@/lib/listing-labels"
import { peerBrandNewStockQuantity } from "@/lib/listing-stock-quantity"
import { surfpackSizeLabel } from "@/lib/surfpack-listing-config"
import { tractionSizeLabel } from "@/lib/traction-listing-config"
import { wetsuitSizeLabel } from "@/lib/wetsuit-listing-config"

export type ListingBoardSpecRow = {
  label: string
  value: string
  href?: string | null
}

export type ListingBoardSpecSource = {
  section?: string | null
  stock_quantity?: number | null
  inventory_source?: string | null
  condition?: string | null
  dimensions?: string | null
  construction?: string | null
  fin_system?: string | null
  fins_setup?: string | null
  fins_included?: boolean | null
}

/** Every buyer-facing spec the public `/l` pages print, plus surfboard shape on mobile. */
export type ListingPublicSpecSource = ListingBoardSpecSource & {
  board_type?: string | null
  fin_size?: string | null
  wetsuit_size?: string | null
  boardbag_size?: string | null
  surfpack_size?: string | null
  leash_size?: string | null
  apparel_kind?: string | null
  apparel_size?: string | null
  magazine_year?: number | string | null
  traction_size?: string | null
  accessory_size?: string | null
}

export function listingConditionSpecRow(
  condition: string | null | undefined,
): ListingBoardSpecRow | null {
  const value = formatHomePeerListingConditionLine(condition)?.replace(" — ", " – ") ?? null
  if (!value) return null
  return { label: "Condition", value }
}

/** Brand-new peer inventory. Hidden for used listings and legacy rows with no stock. */
export function listingAvailableQuantitySpecRow(listing: {
  section?: string | null
  condition?: string | null
  stock_quantity?: number | null
  inventory_source?: string | null
}): ListingBoardSpecRow | null {
  const quantity = peerBrandNewStockQuantity(listing)
  if (quantity < 1) return null
  return {
    label: "Quantity",
    value: quantity === 1 ? "1 available" : `${quantity} available`,
  }
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

  const condition = listingConditionSpecRow(input.condition)
  if (condition) rows.push(condition)
  const quantity = listingAvailableQuantitySpecRow(input)
  if (quantity) rows.push(quantity)

  const geometry = formatListingGeometryLine({ dimensions: input.dimensions })
  if (geometry) rows.push({ label: "Dimensions", value: geometry })

  const volume = formatListingVolumePart({ dimensions: input.dimensions })
  if (volume) rows.push({ label: "Volume", value: volume })

  const construction = labelForOption(CONSTRUCTION_OPTIONS, input.construction)
  if (construction) rows.push({ label: "Construction", value: construction })

  const finSystem = labelForOption(FIN_SYSTEM_OPTIONS, input.fin_system)
  if (finSystem) rows.push({ label: "Fin system", value: finSystem })

  const finSetup = finSetupSpecRow(input.fins_setup, { skipOther: true })
  if (finSetup) rows.push(finSetup)

  if (input.fins_included === true) {
    rows.push({ label: "Fins included", value: "Included" })
  } else if (input.fins_included === false) {
    rows.push({ label: "Fins included", value: "Not included" })
  }

  return rows
}

function compactSpecRows(rows: Array<ListingBoardSpecRow | null | undefined>): ListingBoardSpecRow[] {
  return rows.filter((row): row is ListingBoardSpecRow => Boolean(row))
}

function labeledSpecRow(label: string, value: string | null | undefined): ListingBoardSpecRow | null {
  const text = value?.trim()
  if (!text) return null
  return { label, value: text }
}

function finSetupSpecRow(
  raw: string | null | undefined,
  options?: { skipOther?: boolean },
): ListingBoardSpecRow | null {
  const setups = parseFinsSetupFromStorage(raw).filter((slug) =>
    options?.skipOther ? !SKIP_SLUGS.has(slug) : true,
  )
  if (setups.length === 0) return null
  return {
    label: "Fin setup",
    value: setups.map((slug) => FIN_SETUP_LABELS[slug]).join(", "),
  }
}

function insertAfterCondition(rows: ListingBoardSpecRow[], row: ListingBoardSpecRow): ListingBoardSpecRow[] {
  const conditionIndex = rows.findIndex((item) => item.label === "Condition")
  if (conditionIndex < 0) return [row, ...rows]
  return [...rows.slice(0, conditionIndex + 1), row, ...rows.slice(conditionIndex + 1)]
}

function magazineYearLabel(value: number | string | null | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string" && value.trim()) return value.trim()
  return null
}

function conditionAndQuantityRows(input: ListingPublicSpecSource): ListingBoardSpecRow[] {
  return compactSpecRows([
    listingConditionSpecRow(input.condition),
    listingAvailableQuantitySpecRow(input),
  ])
}

/**
 * Same spec table the website listing pages show.
 * Surfboards also include Shape so the phone table keeps the board style row.
 */
export function listingPublicSpecRows(input: ListingPublicSpecSource): ListingBoardSpecRow[] {
  switch (input.section) {
    case "surfboards": {
      const rows = listingBoardSpecRows(input)
      const shape = labelForOption(BOARD_STYLE_OPTIONS, input.board_type)
      if (!shape) return rows
      return insertAfterCondition(rows, { label: "Shape", value: shape })
    }
    case "fins":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Size", finSizeLabel(input.fin_size)),
        finSetupSpecRow(input.fins_setup),
        labeledSpecRow("Fin system", finSystemLabel(input.fin_system)),
      ])
    case "wetsuits":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Size", wetsuitSizeLabel(input.wetsuit_size)),
      ])
    case "boardbags":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Size", boardbagSizeLabel(input.boardbag_size)),
      ])
    case "surfpacks":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Size", surfpackSizeLabel(input.surfpack_size)),
      ])
    case "leashes":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Size", leashSizeLabel(input.leash_size)),
      ])
    case "apparel":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Category", apparelKindLabel(input.apparel_kind)),
        labeledSpecRow("Size", apparelSizeLabel(input.apparel_size)),
      ])
    case "accessories":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Size", accessorySizeLabel(input.accessory_size)),
      ])
    case "magazines":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Year", magazineYearLabel(input.magazine_year)),
      ])
    case "traction":
      return compactSpecRows([
        ...conditionAndQuantityRows(input),
        labeledSpecRow("Size", tractionSizeLabel(input.traction_size)),
      ])
    default:
      return conditionAndQuantityRows(input)
  }
}
