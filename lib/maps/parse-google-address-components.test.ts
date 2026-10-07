import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  newPlaceAddressComponentsToGeocoder,
  parseGoogleAddressComponents,
} from "./parse-google-address-components.ts"

describe("newPlaceAddressComponentsToGeocoder", () => {
  it("reads Places (new) longText and shortText", () => {
    const geo = newPlaceAddressComponentsToGeocoder([
      { longText: "123", shortText: "123", types: ["street_number"] },
      { longText: "Main Street", shortText: "Main St", types: ["route"] },
      { longText: "Santa Barbara", shortText: "Santa Barbara", types: ["locality", "political"] },
      { longText: "California", shortText: "CA", types: ["administrative_area_level_1", "political"] },
      { longText: "93101", shortText: "93101", types: ["postal_code"] },
      { longText: "United States", shortText: "US", types: ["country", "political"] },
    ])
    const parsed = parseGoogleAddressComponents(geo)
    assert.equal(parsed.line1, "123 Main Street")
    assert.equal(parsed.city, "Santa Barbara")
    assert.equal(parsed.state, "CA")
    assert.equal(parsed.postal_code, "93101")
    assert.equal(parsed.country, "US")
  })

  it("reads legacy long_name and short_name when longText is missing", () => {
    const geo = newPlaceAddressComponentsToGeocoder([
      { long_name: "14", short_name: "14", types: ["street_number"] },
      { long_name: "Oak Lane", short_name: "Oak Ln", types: ["route"] },
      { long_name: "Ojai", short_name: "Ojai", types: ["locality"] },
      { long_name: "California", short_name: "CA", types: ["administrative_area_level_1"] },
      { long_name: "93023", short_name: "93023", types: ["postal_code"] },
      { long_name: "United States", short_name: "US", types: ["country"] },
    ])
    const parsed = parseGoogleAddressComponents(geo)
    assert.equal(parsed.line1, "14 Oak Lane")
    assert.equal(parsed.state, "CA")
    assert.equal(parsed.country, "US")
  })

  it("keeps a full country name as US when shortText is missing", () => {
    const parsed = parseGoogleAddressComponents(
      newPlaceAddressComponentsToGeocoder([
        { longText: "United States", types: ["country", "political"] },
        { longText: "California", types: ["administrative_area_level_1", "political"] },
        { longText: "93101", types: ["postal_code"] },
      ]),
    )
    assert.equal(parsed.country, "US")
    assert.equal(parsed.state, "California")
    assert.equal(parsed.postal_code, "93101")
  })

  it("unwraps FormattableText and drops empty rows", () => {
    const geo = newPlaceAddressComponentsToGeocoder([
      { longText: { text: "500" }, shortText: { text: "500" }, types: ["street_number"] },
      { longText: null, shortText: "", types: ["political"] },
    ])
    assert.equal(geo.length, 1)
    assert.equal(geo[0]?.long_name, "500")
  })
})

describe("parseGoogleAddressComponents", () => {
  it("keeps a US street when the country short name is the full country", () => {
    const parsed = parseGoogleAddressComponents([
      { long_name: "500", short_name: "500", types: ["street_number"] },
      { long_name: "State Street", short_name: "State St", types: ["route"] },
      { long_name: "Santa Barbara", short_name: "Santa Barbara", types: ["locality"] },
      { long_name: "California", short_name: "", types: ["administrative_area_level_1"] },
      { long_name: "93101", short_name: "93101", types: ["postal_code"] },
      { long_name: "United States", short_name: "United States", types: ["country"] },
    ])
    assert.equal(parsed.state, "California")
    assert.equal(parsed.country, "US")
    assert.equal(parsed.city, "Santa Barbara")
    assert.equal(parsed.postal_code, "93101")
  })

  it("uses sublocality when Google omits locality", () => {
    const parsed = parseGoogleAddressComponents([
      { long_name: "88", short_name: "88", types: ["street_number"] },
      { long_name: "Broadway", short_name: "Broadway", types: ["route"] },
      { long_name: "Brooklyn", short_name: "Brooklyn", types: ["sublocality_level_1", "political"] },
      { long_name: "New York", short_name: "NY", types: ["administrative_area_level_1"] },
      { long_name: "11211", short_name: "11211", types: ["postal_code"] },
      { long_name: "United States", short_name: "US", types: ["country"] },
    ])
    assert.equal(parsed.city, "Brooklyn")
    assert.equal(parsed.state, "NY")
  })
})
