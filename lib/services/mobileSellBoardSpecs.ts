import { mobileSellBoardSpecsSchema, type MobileSellBoardSpecs } from "@reswell/api-contract"
import {
  BOARD_LENGTH_OPTIONS,
  BOARD_THICKNESS_OPTIONS,
  BOARD_WIDTH_OPTIONS,
  withInchesDecimalLabels,
  type BoardDimensionOption,
} from "@/lib/board-dimension-options"
import { CONSTRUCTION_OPTIONS, FIN_SETUP_OPTIONS, FIN_SYSTEM_OPTIONS } from "@/lib/boards-browse-facets"

const FINS_INCLUDED_OPTIONS = [
  { value: "included", label: "Fins included" },
  { value: "not_included", label: "Fins not included" },
] as const

type SpecOption = {
  value: string
  label: string
  decimal_label: string | null
}

function selectOptions(options: readonly { value: string; label: string }[], optional: boolean): SpecOption[] {
  const rows = options.map((option) => ({
    value: option.value,
    label: option.label,
    decimal_label: null,
  }))
  if (!optional) return rows
  return [{ value: "", label: "Not specified", decimal_label: null }, ...rows]
}

function dimensionOptions(options: readonly BoardDimensionOption[], withDecimals: boolean): SpecOption[] {
  const decimals = withDecimals ? withInchesDecimalLabels(options) : null
  return options.map((option, index) => {
    const decimal = decimals?.[index]?.label
    return {
      value: option.value,
      label: option.label,
      decimal_label: decimal && decimal !== option.label ? decimal : null,
    }
  })
}

/** Dimensions, fins, and construction for a surfboard listing. Same lists as `/sell` photos. */
export function getMobileSellBoardSpecs(): MobileSellBoardSpecs {
  return mobileSellBoardSpecsSchema.parse({
    sections: [
      {
        id: "dimensions",
        title: null,
        hint: null,
        fields: [
          {
            id: "length",
            label: "Length",
            hint: null,
            required: true,
            kind: "select",
            placeholder: "—",
            suffix: null,
            options: dimensionOptions(BOARD_LENGTH_OPTIONS, false),
          },
          {
            id: "width",
            label: "Width",
            hint: null,
            required: false,
            kind: "select",
            placeholder: "—",
            suffix: null,
            options: dimensionOptions(BOARD_WIDTH_OPTIONS, true),
          },
          {
            id: "thickness",
            label: "Thickness",
            hint: null,
            required: false,
            kind: "select",
            placeholder: "—",
            suffix: null,
            options: dimensionOptions(BOARD_THICKNESS_OPTIONS, true),
          },
          {
            id: "volume",
            label: "Volume",
            hint: null,
            required: false,
            kind: "text",
            placeholder: "—",
            suffix: "L",
            options: [],
          },
        ],
      },
      {
        id: "facets",
        title: "Fins & construction",
        hint: "Optional — helps buyers scan the listing.",
        fields: [
          {
            id: "fin_setup",
            label: "Fin setup",
            hint: "How many fins the board is set up for (thruster, quad, etc.).",
            required: false,
            kind: "select",
            placeholder: "Not specified",
            suffix: null,
            options: selectOptions(FIN_SETUP_OPTIONS, true),
          },
          {
            id: "fin_system",
            label: "Fin system",
            hint: "Plug or box type (Futures, FCS, glass-on, etc.).",
            required: false,
            kind: "select",
            placeholder: "Not specified",
            suffix: null,
            options: selectOptions(FIN_SYSTEM_OPTIONS, true),
          },
          {
            id: "fins_included",
            label: "Fins included",
            hint: null,
            required: false,
            kind: "select",
            placeholder: "Not specified",
            suffix: null,
            options: selectOptions(FINS_INCLUDED_OPTIONS, true),
          },
          {
            id: "construction",
            label: "Construction",
            hint: null,
            required: false,
            kind: "select",
            placeholder: "Not specified",
            suffix: null,
            options: selectOptions(CONSTRUCTION_OPTIONS, true),
          },
        ],
      },
    ],
  })
}
