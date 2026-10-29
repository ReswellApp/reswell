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

export type AdminOrderStaffCapabilityInput = {
  /** Must be the boolean `true`. A missing flag (the requireAdmin regression) is not admin. */
  isAdmin: boolean | undefined
  isReswellShop: boolean
  status: string
  fulfillmentMethod: string | null
  deliveryStatus: string | null
  hasBuyer: boolean
}

export type AdminOrderStaffCapabilities = Pick<
  AdminOrderCapabilities,
  | "canRefund"
  | "canReleaseShippingSellerEarnings"
  | "canFulfillReswellShop"
  | "canReplaceShippingLabel"
>

/**
 * Refunds, item returns, payouts, and label replacement are marketplace-admin
 * actions. Shop team membership never grants these.
 */
export function adminOrderStaffCapabilities(
  input: AdminOrderStaffCapabilityInput,
): AdminOrderStaffCapabilities {
  const isAdmin = input.isAdmin === true
  return {
    canRefund: isAdmin,
    canReleaseShippingSellerEarnings: isAdmin && !input.isReswellShop,
    canFulfillReswellShop:
      isAdmin &&
      input.isReswellShop &&
      input.status === "confirmed" &&
      input.fulfillmentMethod === "shipping" &&
      input.deliveryStatus === "pending" &&
      input.hasBuyer,
    canReplaceShippingLabel:
      isAdmin &&
      !input.isReswellShop &&
      input.fulfillmentMethod === "shipping" &&
      (input.status === "confirmed" || input.status === "refunding") &&
      input.deliveryStatus !== "delivered" &&
      input.deliveryStatus !== "picked_up",
  }
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
