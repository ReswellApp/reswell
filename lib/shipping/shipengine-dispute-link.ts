import { inferAdjustmentCarrier, type AdjustmentDisputeCarrier } from "@/lib/shipping/adjustment-fee"
import { resolveShipEngineCarrierCode } from "@/lib/shipping/resolve-carrier-code"
import { SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL } from "@/lib/types/protectionClaimDesk"

/** USPS Automated Package Verification form used for ShipEngine / Stamps labels. */
export const USPS_APV_DISPUTE_URL = "https://apvdisputes.usps.com"

/**
 * Stamps.com (ShipEngine Carriers) has no public FedEx dispute form.
 * This article is the filing checklist their carrier team asks for.
 */
export const FEDEX_SHIPENGINE_DISPUTE_HELP_URL =
  "https://help.stamps.com/hc/en-us/articles/20821909092123-Post-Shipment-Billing-Adjustments"

export type ShipEngineDisputeLink = {
  href: string
  label: string
  hint: string
}

function disputeCarrier(
  trackingCarrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): AdjustmentDisputeCarrier | null {
  const inferred = inferAdjustmentCarrier(trackingCarrier, trackingNumber)
  if (inferred) return inferred

  const code = resolveShipEngineCarrierCode(trackingNumber ?? "", trackingCarrier)
  if (code === "ups" || code === "ups_walleted") return "ups"
  if (code === "usps" || code === "stamps_com" || code === "endicia") return "usps"
  if (code === "fedex") return "fedex"
  return null
}

/**
 * External page an admin opens to dispute a ShipEngine label on this shipment.
 * UPS uses the Stamps One Balance form. USPS uses the APV dispute form.
 */
export function shipEngineDisputeLinkForShipment(input: {
  trackingCarrier?: string | null
  trackingNumber?: string | null
}): ShipEngineDisputeLink {
  const carrier = disputeCarrier(input.trackingCarrier, input.trackingNumber)

  if (carrier === "usps") {
    return {
      href: USPS_APV_DISPUTE_URL,
      label: "ShipEngine USPS dispute",
      hint: "Opens the USPS package verification form ShipEngine uses for these labels. Enter the adjustment ID and this tracking number.",
    }
  }

  if (carrier === "fedex") {
    return {
      href: FEDEX_SHIPENGINE_DISPUTE_HELP_URL,
      label: "ShipEngine FedEx dispute",
      hint: "FedEx adjustment disputes are filed with ShipEngine support. This page lists the tracking number, charge, and photos to include.",
    }
  }

  return {
    href: SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL,
    label: "ShipEngine dispute",
    hint: "Opens the ShipEngine UPS form for this shipment. Use it to dispute a billing adjustment or file a loss and damage claim.",
  }
}
