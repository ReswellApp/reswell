export type AdminOrderShipFromOnFile = {
  name: string
  oneLine: string
}

export type AdminOrderCapabilities = {
  canRefund: boolean
  canReleaseShippingSellerEarnings: boolean
  hasShippingLabel: boolean
  hasPaperlessQr: boolean
  paperlessInstructions: string | null
  paperlessHandoffCode: string | null
  canFulfillReswellShop: boolean
  canReplaceShippingLabel: boolean
  shipFromOnFile: AdminOrderShipFromOnFile | null
}

/** Slice of order capabilities the case inbox needs for briefing + label preview. */
export type CaseOrderLabelContext = {
  hasShippingLabel: boolean
  hasPaperlessQr: boolean
  paperlessInstructions: string | null
  paperlessHandoffCode: string | null
  shipFromOnFile: AdminOrderShipFromOnFile | null
}

export function caseOrderLabelContextFromCapabilities(
  caps: Partial<AdminOrderCapabilities> | null | undefined,
): CaseOrderLabelContext {
  const ship = caps?.shipFromOnFile
  return {
    hasShippingLabel: caps?.hasShippingLabel === true,
    hasPaperlessQr: caps?.hasPaperlessQr === true,
    paperlessInstructions: caps?.paperlessInstructions ?? null,
    paperlessHandoffCode: caps?.paperlessHandoffCode ?? null,
    shipFromOnFile:
      ship && typeof ship.name === "string" && typeof ship.oneLine === "string"
        ? { name: ship.name, oneLine: ship.oneLine }
        : null,
  }
}
