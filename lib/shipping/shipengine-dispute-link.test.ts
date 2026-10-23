import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL } from "@/lib/types/protectionClaimDesk"
import {
  FEDEX_SHIPENGINE_DISPUTE_HELP_URL,
  USPS_APV_DISPUTE_URL,
  shipEngineDisputeLinkForShipment,
} from "./shipengine-dispute-link.ts"

describe("shipEngineDisputeLinkForShipment", () => {
  it("opens the ShipEngine UPS form for UPS labels", () => {
    const link = shipEngineDisputeLinkForShipment({
      trackingCarrier: "ups · ups_ground",
      trackingNumber: "1Z999AA10123456784",
    })
    assert.equal(link.href, SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL)
    assert.equal(link.label, "ShipEngine dispute")
  })

  it("opens the USPS verification form for Stamps USPS labels", () => {
    const link = shipEngineDisputeLinkForShipment({
      trackingCarrier: "stamps_com · usps_priority_mail",
      trackingNumber: "9400111899223197428490",
    })
    assert.equal(link.href, USPS_APV_DISPUTE_URL)
    assert.match(link.label, /USPS/)
  })

  it("opens the FedEx filing checklist when the carrier is FedEx", () => {
    const link = shipEngineDisputeLinkForShipment({
      trackingCarrier: "fedex · fedex_ground",
      trackingNumber: "748909876543210",
    })
    assert.equal(link.href, FEDEX_SHIPENGINE_DISPUTE_HELP_URL)
  })

  it("falls back to the ShipEngine UPS form when the carrier is unknown", () => {
    const link = shipEngineDisputeLinkForShipment({
      trackingCarrier: null,
      trackingNumber: null,
    })
    assert.equal(link.href, SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL)
  })

  it("reads a bare UPS tracking number when the carrier was not saved", () => {
    const link = shipEngineDisputeLinkForShipment({
      trackingCarrier: null,
      trackingNumber: "1Z999AA10123456784",
    })
    assert.equal(link.href, SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL)
  })
})
