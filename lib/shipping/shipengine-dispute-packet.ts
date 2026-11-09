import {
  adjustmentCarrierLabel,
  adjustmentDisputeReasonLabel,
  formatAdjustmentUsd,
  type AdjustmentDisputeCarrier,
  type AdjustmentDisputeReasonCode,
} from "@/lib/shipping/adjustment-fee"
import {
  FEDEX_SHIPENGINE_DISPUTE_HELP_URL,
  USPS_APV_DISPUTE_URL,
  shipEngineDisputeLinkForShipment,
} from "@/lib/shipping/shipengine-dispute-link"
import { RESWELL_CONTACT_EMAIL } from "@/lib/constants/contact"
import { SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL } from "@/lib/types/protectionClaimDesk"

export type DisputePacketDims = {
  lengthIn: number | null
  widthIn: number | null
  heightIn: number | null
  weightLb: number | null
}

export type ShipEngineDisputePacketInput = {
  carrier: AdjustmentDisputeCarrier
  trackingNumber: string | null
  trackingCarrier?: string | null
  orderDisplayNum: string | null
  orderId: string
  listingTitle: string | null
  adjustmentAmountUsd: number
  adjustmentAt: string | null
  adjustmentId: string | null
  adjustmentType: string | null
  reasonCode: string | null
  carrierMeasured: DisputePacketDims
  labeled: DisputePacketDims
  claimed: DisputePacketDims
  disputeReasonCode: AdjustmentDisputeReasonCode | null
  sellerStatement: string | null
  stampsAccountEmail: string
  contactName: string
  companyName: string
  companyPhone: string
  contactEmail: string
  today: Date
}

export type ShipEngineDisputeCopyField = {
  id: string
  label: string
  value: string
  hint?: string
}

export type ShipEngineDisputePacket = {
  carrier: AdjustmentDisputeCarrier
  formUrl: string
  formLabel: string
  formHint: string
  filingSteps: string[]
  narrative: string
  fields: ShipEngineDisputeCopyField[]
  fullClipboard: string
}

function finite(value: number | null | undefined): number | null {
  if (value == null) return null
  return Number.isFinite(value) ? value : null
}

export function formatDisputeDimsInches(dims: DisputePacketDims): string | null {
  const length = finite(dims.lengthIn)
  const width = finite(dims.widthIn)
  const height = finite(dims.heightIn)
  if (length == null && width == null && height == null) return null
  return `${length ?? "—"} × ${width ?? "—"} × ${height ?? "—"} in`
}

export function formatDisputeWeightLb(weightLb: number | null | undefined): string | null {
  const weight = finite(weightLb)
  if (weight == null) return null
  return `${weight} lb`
}

function mmDdYyyyInLosAngeles(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"
  const year = parts.find((part) => part.type === "year")?.value ?? "1970"
  return `${month}/${day}/${year}`
}

function orderLabel(orderDisplayNum: string | null, orderId: string): string {
  if (orderDisplayNum?.trim()) return `#${orderDisplayNum.trim()}`
  return orderId.slice(0, 8)
}

function preferredDims(...candidates: DisputePacketDims[]): DisputePacketDims {
  for (const dims of candidates) {
    if (
      finite(dims.lengthIn) != null ||
      finite(dims.widthIn) != null ||
      finite(dims.heightIn) != null ||
      finite(dims.weightLb) != null
    ) {
      return dims
    }
  }
  return candidates[0] ?? {
    lengthIn: null,
    widthIn: null,
    heightIn: null,
    weightLb: null,
  }
}

function reasonSentence(
  carrier: AdjustmentDisputeCarrier,
  reason: AdjustmentDisputeReasonCode | null,
): string {
  if (!reason) {
    return `We believe this ${adjustmentCarrierLabel(carrier)} post-shipment billing adjustment was applied in error.`
  }
  return `Dispute reason: ${adjustmentDisputeReasonLabel(carrier, reason)}.`
}

/**
 * Draft narrative for ShipEngine / Stamps Carrier Services when disputing a
 * UPS One Balance (or other) post-shipment billing adjustment.
 */
export function buildAdjustmentDisputeNarrative(input: {
  carrier: AdjustmentDisputeCarrier
  trackingNumber: string | null
  orderDisplayNum: string | null
  orderId: string
  listingTitle: string | null
  adjustmentAmountUsd: number
  adjustmentAt: string | null
  adjustmentId: string | null
  adjustmentType: string | null
  reasonCode: string | null
  carrierMeasured: DisputePacketDims
  labeled: DisputePacketDims
  claimed: DisputePacketDims
  disputeReasonCode: AdjustmentDisputeReasonCode | null
  sellerStatement: string | null
}): string {
  const carrierName = adjustmentCarrierLabel(input.carrier)
  const lines: string[] = [
    `This is a post-shipment billing adjustment dispute for a ${carrierName} label purchased through ShipEngine / Stamps.com One Balance — not a loss or damage claim.`,
    reasonSentence(input.carrier, input.disputeReasonCode),
    `Tracking number: ${input.trackingNumber?.trim() || "unknown"}.`,
    `Reswell order: ${orderLabel(input.orderDisplayNum, input.orderId)}.`,
  ]

  if (input.listingTitle?.trim()) {
    lines.push(`Shipment contents: ${input.listingTitle.trim()}.`)
  }

  if (input.adjustmentAmountUsd > 0) {
    lines.push(`Adjustment amount: ${formatAdjustmentUsd(input.adjustmentAmountUsd)}.`)
  }

  if (input.adjustmentAt) {
    lines.push(`Adjustment date (UTC): ${input.adjustmentAt}.`)
  }
  if (input.adjustmentId?.trim()) {
    lines.push(`Carrier / ShipEngine adjustment ID: ${input.adjustmentId.trim()}.`)
  }
  if (input.adjustmentType?.trim() || input.reasonCode?.trim()) {
    lines.push(
      `Reported adjustment type/reason: ${[input.adjustmentType, input.reasonCode]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(" / ")}.`,
    )
  }

  const labeledDims = formatDisputeDimsInches(input.labeled)
  const labeledWeight = formatDisputeWeightLb(input.labeled.weightLb)
  if (labeledDims || labeledWeight) {
    lines.push(
      `Dimensions/weight entered on the shipping label: ${[labeledDims, labeledWeight]
        .filter(Boolean)
        .join("; ")}.`,
    )
  }

  const claimed = preferredDims(input.claimed, input.labeled)
  const claimedDims = formatDisputeDimsInches(claimed)
  const claimedWeight = formatDisputeWeightLb(claimed.weightLb)
  if (claimedDims || claimedWeight) {
    lines.push(
      `Packed package as measured by the shipper: ${[claimedDims, claimedWeight]
        .filter(Boolean)
        .join("; ")}.`,
    )
  }

  const carrierDims = formatDisputeDimsInches(input.carrierMeasured)
  const carrierWeight = formatDisputeWeightLb(input.carrierMeasured.weightLb)
  if (carrierDims || carrierWeight) {
    lines.push(
      `Carrier-reported actuals on the adjustment: ${[carrierDims, carrierWeight]
        .filter(Boolean)
        .join("; ")}.`,
    )
  }

  const seller = input.sellerStatement?.trim()
  if (seller) {
    lines.push(`Seller statement to Reswell: ${seller}`)
  }

  lines.push(
    `We request that ${carrierName} / Stamps Carrier Services reverse this adjustment. Photo evidence of the packed carton dimensions and shipping label can be provided on request.`,
  )

  return lines.join("\n\n")
}

function upsFilingSteps(): string[] {
  return [
    "Open the UPS from Stamps.com inquiry form (linked below).",
    "Enter today’s date, the Stamps.com / ShipEngine account email, and Reswell contact fields.",
    "When asked what you are looking to do, choose the closest inquiry path available (this form also handles claims/reroutes). Make it clear in the written description that this is a billing adjustment dispute, not loss/damage.",
    "Paste the tracking number wherever the form asks for a 1Z number.",
    "Paste the drafted dispute narrative into the description / additional-info essay fields.",
    "Upload clear photos: shipping label close-up, all six sides of the carton, and a tape measure showing L×W×H. Stamps often needs photos to process dimension/weight disputes.",
    "Submit within 90 days of the adjustment billing date.",
  ]
}

function uspsFilingSteps(): string[] {
  return [
    "Open the USPS Automated Package Verification (APV) dispute form.",
    "Enter the Revenue Assurance / Adjustment ID (omit leading zeros).",
    "Enter the last 4 digits of the tracking number (IMPB).",
    "Keep the drafted narrative for any follow-up email from USPS or Stamps.",
  ]
}

function fedexFilingSteps(): string[] {
  return [
    "Open the Stamps post-shipment adjustment help page for the FedEx filing checklist.",
    "Contact Stamps / ShipEngine support with tracking number, charge amount, dispute reason, and package dimensions.",
    "Attach photo evidence of dimensions and weight — required for FedEx adjustment disputes.",
    "Paste the drafted narrative into the support ticket.",
  ]
}

export function buildShipEngineDisputePacket(
  input: ShipEngineDisputePacketInput,
): ShipEngineDisputePacket {
  const link = shipEngineDisputeLinkForShipment({
    trackingCarrier: input.trackingCarrier ?? input.carrier,
    trackingNumber: input.trackingNumber,
  })

  const formUrl =
    input.carrier === "usps"
      ? USPS_APV_DISPUTE_URL
      : input.carrier === "fedex"
        ? FEDEX_SHIPENGINE_DISPUTE_HELP_URL
        : SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL

  const narrative = buildAdjustmentDisputeNarrative(input)
  const today = mmDdYyyyInLosAngeles(input.today)
  const tracking = input.trackingNumber?.trim() || ""
  const adjId = input.adjustmentId?.trim() || ""
  const claimed = preferredDims(input.claimed, input.labeled)

  const fields: ShipEngineDisputeCopyField[] = [
    {
      id: "today",
      label: "Today’s date (MM/DD/YYYY)",
      value: today,
      hint: "Alchemer “Today’s Date” field",
    },
    {
      id: "stamps_email",
      label: "Stamps.com account email",
      value: input.stampsAccountEmail,
      hint: "Must match the ShipEngine / Stamps One Balance account",
    },
    {
      id: "contact_name",
      label: "Contact name",
      value: input.contactName,
    },
    {
      id: "company_name",
      label: "Company name",
      value: input.companyName,
    },
    {
      id: "company_phone",
      label: "Company phone",
      value: input.companyPhone,
    },
    {
      id: "contact_email",
      label: "Contact email",
      value: input.contactEmail,
      hint: "Preferred reply email for Carrier Services",
    },
    {
      id: "tracking",
      label: "Shipment tracking number",
      value: tracking,
      hint: input.carrier === "ups" ? "Starts with 1Z" : "Carrier tracking number",
    },
  ]

  if (input.carrier === "usps" && adjId) {
    fields.push({
      id: "adjustment_id",
      label: "USPS Adjustment / Revenue Assurance ID",
      value: adjId.replace(/^0+/, "") || adjId,
      hint: "Omit leading zeros on the APV form",
    })
    if (tracking.length >= 4) {
      fields.push({
        id: "tracking_last4",
        label: "Last 4 of tracking (IMPB)",
        value: tracking.slice(-4),
      })
    }
  }

  if (adjId && input.carrier !== "usps") {
    fields.push({
      id: "adjustment_id",
      label: "Adjustment ID",
      value: adjId,
    })
  }

  const claimedDims = formatDisputeDimsInches(claimed)
  if (claimedDims) {
    fields.push({
      id: "claimed_dims",
      label: "Packed dimensions (L × W × H)",
      value: claimedDims,
    })
  }
  const claimedWeight = formatDisputeWeightLb(claimed.weightLb)
  if (claimedWeight) {
    fields.push({
      id: "claimed_weight",
      label: "Packed weight",
      value: claimedWeight,
    })
  }

  fields.push({
    id: "narrative",
    label: "Dispute narrative",
    value: narrative,
    hint: "Paste into the form’s description / additional-info fields",
  })

  const filingSteps =
    input.carrier === "usps"
      ? uspsFilingSteps()
      : input.carrier === "fedex"
        ? fedexFilingSteps()
        : upsFilingSteps()

  const fullClipboard = [
    `ShipEngine ${adjustmentCarrierLabel(input.carrier)} adjustment dispute packet`,
    `Form: ${formUrl}`,
    "",
    ...fields.map((field) => `${field.label}:\n${field.value}`),
  ].join("\n\n")

  return {
    carrier: input.carrier,
    formUrl,
    formLabel: link.label,
    formHint: link.hint,
    filingSteps,
    narrative,
    fields,
    fullClipboard,
  }
}

export function defaultDisputePacketContact(overrides?: {
  stampsAccountEmail?: string | null
  contactName?: string | null
  companyName?: string | null
  companyPhone?: string | null
  contactEmail?: string | null
}): {
  stampsAccountEmail: string
  contactName: string
  companyName: string
  companyPhone: string
  contactEmail: string
} {
  const stamps =
    overrides?.stampsAccountEmail?.trim() ||
    process.env.SHIPENGINE_STAMPS_ACCOUNT_EMAIL?.trim() ||
    RESWELL_CONTACT_EMAIL
  const contactEmail =
    overrides?.contactEmail?.trim() || RESWELL_CONTACT_EMAIL
  return {
    stampsAccountEmail: stamps,
    contactName: overrides?.contactName?.trim() || "Reswell Shipping",
    companyName: overrides?.companyName?.trim() || "Reswell",
    companyPhone: overrides?.companyPhone?.trim() || "",
    contactEmail,
  }
}
