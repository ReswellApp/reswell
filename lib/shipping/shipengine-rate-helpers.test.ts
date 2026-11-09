import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractInvalidRatesFromApiEnvelope } from "./shipengine-rate-helpers.ts"

describe("extractInvalidRatesFromApiEnvelope", () => {
  it("reads ShipEngine invalid_rates messages", () => {
    const summaries = extractInvalidRatesFromApiEnvelope({
      rate_response: {
        rates: [],
        invalid_rates: [
          {
            service_code: "usps_ground_advantage",
            service_type: "USPS Ground Advantage",
            error_messages: ["Recipient address is not valid for this service."],
          },
        ],
      },
    })
    assert.equal(summaries.length, 1)
    assert.equal(summaries[0]?.serviceCode, "usps_ground_advantage")
    assert.match(summaries[0]?.message ?? "", /Recipient address/)
  })
})
