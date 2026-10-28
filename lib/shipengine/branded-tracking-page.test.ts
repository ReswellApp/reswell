import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  brandedTrackingCountrySupported,
  buildBrandedTrackingPageBody,
  parseBrandedTrackingPageUrl,
  serviceCodeFromTrackingCarrier,
} from "./branded-tracking-page"
import { normalizeBrandedTrackingUrl } from "@/lib/utils/branded-tracking-url"
import { packageTrackHref, preferredTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import { resolveShipEngineCarrierCode } from "@/lib/shipping/resolve-carrier-code"

const locality = {
  cityLocality: "Santa Barbara",
  stateProvince: "CA",
  postalCode: "93101",
  countryCode: "US",
}

describe("branded tracking page", () => {
  it("parses the hosted url and forces https", () => {
    const url = parseBrandedTrackingPageUrl({
      tracking_pages: [
        { url: "http://track.shipengine.com/se/v1/MYkORKpDv02x-LX3yv7bdQ" },
      ],
    })
    assert.equal(url, "https://track.shipengine.com/se/v1/MYkORKpDv02x-LX3yv7bdQ")
  })

  it("parses a nested data wrapper or top-level url", () => {
    assert.equal(
      parseBrandedTrackingPageUrl({
        data: { url: "https://track.shipengine.com/se/v1/nested" },
      }),
      "https://track.shipengine.com/se/v1/nested",
    )
    assert.equal(
      parseBrandedTrackingPageUrl({ url: "https://track.shipengine.com/se/v1/top" }),
      "https://track.shipengine.com/se/v1/top",
    )
  })

  it("rejects other hosts", () => {
    assert.equal(normalizeBrandedTrackingUrl("https://tools.usps.com/go/TrackConfirmAction"), null)
    assert.equal(normalizeBrandedTrackingUrl("javascript:alert(1)"), null)
  })

  it("builds the tracking_pages body", () => {
    const body = buildBrandedTrackingPageBody("theme-1", {
      trackingNumber: "1Z999",
      carrierCode: "ups",
      serviceCode: "ups_ground",
      shipTo: locality,
      shipFrom: { ...locality, cityLocality: "Los Angeles", postalCode: "90001" },
    })
    const pages = body.tracking_pages as Array<Record<string, string>>
    assert.equal(pages[0]?.branded_tracking_theme_guid, "theme-1")
    assert.equal(pages[0]?.carrier_code, "ups")
    assert.equal(pages[0]?.service_code, "ups_ground")
    assert.equal(pages[0]?.to_country_code, "US")
  })

  it("reads a service code from the stored carrier label", () => {
    assert.equal(serviceCodeFromTrackingCarrier("usps · usps_priority_mail"), "usps_priority_mail")
    assert.equal(serviceCodeFromTrackingCarrier("USPS"), null)
  })

  it("limits the portal to supported countries", () => {
    assert.equal(brandedTrackingCountrySupported("US"), true)
    assert.equal(brandedTrackingCountrySupported("uk"), true)
    assert.equal(brandedTrackingCountrySupported("DE"), false)
  })

  it("prefers the branded page and never returns a carrier site", () => {
    assert.equal(
      preferredTrackingUrl({
        brandedUrl: "https://track.shipengine.com/se/v1/abc",
        trackingNumber: "1Z999",
        trackingCarrier: "ups",
      }),
      "https://track.shipengine.com/se/v1/abc",
    )
    assert.equal(
      preferredTrackingUrl({ trackingNumber: "1Z999", trackingCarrier: "ups" }),
      null,
    )
  })

  it("keeps the carrier code in front of a usps service name", () => {
    assert.equal(
      resolveShipEngineCarrierCode("9400111899223197428490", "stamps_com · usps_priority_mail"),
      "stamps_com",
    )
    assert.equal(
      resolveShipEngineCarrierCode("9400111899223197428490", "usps · usps_media_mail"),
      "usps",
    )
  })

  it("retries the branded page on click when the saved link is a carrier site", () => {
    const orderId = "11111111-1111-4111-8111-111111111111"
    assert.equal(
      packageTrackHref({
        orderId,
        brandedUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=1",
        trackingNumber: "9400111899223197428490",
        trackingCarrier: "usps",
      }),
      `/api/orders/${orderId}/track`,
    )
    assert.equal(
      packageTrackHref({
        orderId,
        brandedUrl: "https://track.shipengine.com/se/v1/abc",
        trackingNumber: "9400111899223197428490",
        trackingCarrier: "usps",
      }),
      "https://track.shipengine.com/se/v1/abc",
    )
    assert.equal(
      packageTrackHref({
        orderId,
        trackingNumber: "1Z999AA10123456784",
        trackingCarrier: "ups",
      }),
      `/api/orders/${orderId}/track`,
    )
    assert.equal(
      packageTrackHref({
        trackingNumber: "1Z999AA10123456784",
        trackingCarrier: "ups",
      }),
      null,
    )
  })
})
