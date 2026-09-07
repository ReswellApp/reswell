/**
 * A catalog model's stock size (from `brand_model_variants`) prepared for the
 * `/sell` boards dimensions picker. `values` are already normalized into the
 * exact formats the sell form stores (`6'0`, `19 1/4`, `2 1/2`, `32.5`), so
 * selecting a size is a plain `setFormData` — same fields, same DB storage.
 */
export type SurfboardStockSizeOption = {
  id: string
  /** Raw catalog labels for display (e.g. `6'0"`, `19 1/4"`, `32.5L`). */
  lengthLabel: string
  widthLabel: string
  thicknessLabel: string
  volumeLabel: string
  values: {
    boardLength: string
    boardWidthInches: string
    boardThicknessInches: string
    /** Empty string when the catalog row has no volume. */
    boardVolumeL: string
  }
}

export type SurfboardStockSizesResponse = {
  sizes: SurfboardStockSizeOption[]
}
