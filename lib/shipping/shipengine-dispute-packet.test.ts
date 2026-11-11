import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL } from "@/lib/types/protectionClaimDesk"
import { USPS_APV_DISPUTE_URL } from "./shipengine-dispute-link.ts"
import {
  buildAdjustmentDisputeNarrative,
  buildShipEngineDisputePacket,
  formatDisputeDimsInches,
} from "./shipengine-dispute-packet.ts"

const baseDims = {
  lengthIn: 78,
  widthIn: 18,
  heightIn: 6,
  weightLb: 22,
}

describe("formatDisputeDimsInches", () => {
  it("formats L×W×H and skips empty packets", () => {
    assert.equal(formatDisputeDimsInches(baseDims), "78 × 18 × 6 in")
    assert.equal(
      formatDisputeDimsInches({
        lengthIn: null,
        widthIn: null,
        heightIn: null,
        weightLb: 10,
      }),
      null,
    )
  })
})

describe("buildAdjustmentDisputeNarrative", () => {
  it("states this is a billing adjustment dispute and includes key facts", () => {
    const narrative = buildAdjustmentDisputeNarrative({
      carrier: "ups",
      trackingNumber: "1Z999AA10123456784",
      orderDisplayNum: "1042",
      orderId: "11111111-1111-1111-1111-111111111111",
      listingTitle: "7'2\" Firewire",
      adjustmentAmountUsd: 42.5,
      adjustmentAt: "2026-11-01T12:00:00.000Z",
      adjustmentId: "ADJ-9",
      adjustmentType: "Shipping Charge Correction",
      reasonCode: "Incorrect dimensions",
      carrierMeasured: { ...baseDims, lengthIn: 84 },
      labeled: baseDims,
      claimed: baseDims,
      disputeReasonCode: "dimensions_match_label",
      sellerStatement: "I measured the packed board bag at 78x18x6 before dropping off.",
    })

    assert.match(narrative, /billing adjustment dispute/i)
    assert.match(narrative, /not a loss or damage claim/i)
    assert.match(narrative, /1Z999AA10123456784/)
    assert.match(narrative, /#1042/)
    assert.match(narrative, /\$42\.50/)
    assert.match(narrative, /78 × 18 × 6 in/)
    assert.match(narrative, /84 × 18 × 6 in/)
    assert.match(narrative, /Packed size matched the UPS label/)
    assert.match(narrative, /I measured the packed board bag/)
  })
})

describe("buildShipEngineDisputePacket", () => {
  it("builds UPS Alchemer copy fields and clipboard text", () => {
    const packet = buildShipEngineDisputePacket({
      carrier: "ups",
      trackingNumber: "1Z999AA10123456784",
      trackingCarrier: "ups",
      orderDisplayNum: "1042",
      orderId: "11111111-1111-1111-1111-111111111111",
      listingTitle: "7'2\" Firewire",
      adjustmentAmountUsd: 12,
      adjustmentAt: null,
      adjustmentId: "ADJ-1",
      adjustmentType: null,
      reasonCode: null,
      carrierMeasured: baseDims,
      labeled: baseDims,
      claimed: baseDims,
      disputeReasonCode: "weight_match_label",
      sellerStatement: null,
      stampsAccountEmail: "labels@reswell.app",
      contactName: "Reswell Shipping",
      companyName: "Reswell",
      companyPhone: "8055550100",
      contactEmail: "hayden@reswell.app",
      today: new Date("2026-11-08T20:00:00.000Z"),
    })

    assert.equal(packet.formUrl, SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL)
    assert.ok(packet.fields.some((field) => field.id === "stamps_email" && field.value === "labels@reswell.app"))
    assert.ok(packet.fields.some((field) => field.id === "tracking" && field.value.startsWith("1Z")))
    assert.ok(packet.fields.some((field) => field.id === "narrative"))
    assert.match(packet.fullClipboard, /Dispute narrative/)
    assert.ok(packet.filingSteps.length >= 4)
  })

  it("adds USPS APV adjustment id and last-4 fields", () => {
    const packet = buildShipEngineDisputePacket({
      carrier: "usps",
      trackingNumber: "9400111899223197428490",
      trackingCarrier: "stamps_com",
      orderDisplayNum: null,
      orderId: "11111111-1111-1111-1111-111111111111",
      listingTitle: null,
      adjustmentAmountUsd: 3.25,
      adjustmentAt: null,
      adjustmentId: "00012345",
      adjustmentType: null,
      reasonCode: null,
      carrierMeasured: {
        lengthIn: null,
        widthIn: null,
        heightIn: null,
        weightLb: null,
      },
      labeled: {
        lengthIn: null,
        widthIn: null,
        heightIn: null,
        weightLb: null,
      },
      claimed: {
        lengthIn: null,
        widthIn: null,
        heightIn: null,
        weightLb: null,
      },
      disputeReasonCode: null,
      sellerStatement: null,
      stampsAccountEmail: "labels@reswell.app",
      contactName: "Reswell Shipping",
      companyName: "Reswell",
      companyPhone: "",
      contactEmail: "hayden@reswell.app",
      today: new Date("2026-11-08T20:00:00.000Z"),
    })

    assert.equal(packet.formUrl, USPS_APV_DISPUTE_URL)
    assert.equal(
      packet.fields.find((field) => field.id === "adjustment_id")?.value,
      "12345",
    )
    assert.equal(
      packet.fields.find((field) => field.id === "tracking_last4")?.value,
      "8490",
    )
  })
})
