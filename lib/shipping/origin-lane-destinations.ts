/**
 * Sample buyer destinations for origin-only rate shopping.
 * In-state uses a major city in the shipper's state (a second city if they
 * already live in the first). Cross-country uses the opposite coast.
 */

import type { AddressFields } from "@/app/admin/shipping/address-fields"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

export type OriginLaneId = "in_state" | "cross_country"

export type OriginLaneDestination = {
  lane: OriginLaneId
  sampleCityLabel: string
  shipTo: AddressFields
}

function dest(
  address_line1: string,
  city_locality: string,
  state_province: string,
  postal_code: string,
): AddressFields {
  return {
    name: "Buyer",
    phone: "555-0100",
    company_name: "",
    address_line1,
    address_line2: "",
    city_locality,
    state_province,
    postal_code,
    country_code: "US",
    residential: "yes",
  }
}

const CROSS_COUNTRY_EAST = dest("350 5th Ave", "New York", "NY", "10118")
const CROSS_COUNTRY_WEST = dest("200 N Spring St", "Los Angeles", "CA", "90012")

/** Origins that treat New York as the far lane. Everyone else uses Los Angeles. */
const WEST_ORIGIN_STATES = new Set([
  "AK",
  "AZ",
  "CA",
  "CO",
  "HI",
  "ID",
  "MT",
  "NM",
  "NV",
  "OR",
  "UT",
  "WA",
  "WY",
])

type StateCityPair = readonly [AddressFields, AddressFields]

const IN_STATE_CITIES: Record<string, StateCityPair> = {
  AL: [dest("710 20th St N", "Birmingham", "AL", "35203"), dest("103 N Perry St", "Montgomery", "AL", "36104")],
  AK: [dest("632 W 6th Ave", "Anchorage", "AK", "99501"), dest("800 Cushman St", "Fairbanks", "AK", "99701")],
  AZ: [dest("200 W Washington St", "Phoenix", "AZ", "85003"), dest("255 W Alameda St", "Tucson", "AZ", "85701")],
  AR: [dest("500 W Markham St", "Little Rock", "AR", "72201"), dest("113 W Mountain St", "Fayetteville", "AR", "72701")],
  CA: [dest("200 N Spring St", "Los Angeles", "CA", "90012"), dest("202 C St", "San Diego", "CA", "92101")],
  CO: [dest("1437 Bannock St", "Denver", "CO", "80202"), dest("107 N Nevada Ave", "Colorado Springs", "CO", "80903")],
  CT: [dest("550 Main St", "Hartford", "CT", "06103"), dest("165 Church St", "New Haven", "CT", "06510")],
  DE: [dest("800 N French St", "Wilmington", "DE", "19801"), dest("1 The Green", "Dover", "DE", "19901")],
  DC: [dest("1350 Pennsylvania Ave NW", "Washington", "DC", "20004"), dest("3100 Dumbarton St NW", "Washington", "DC", "20007")],
  FL: [dest("200 Biscayne Blvd", "Miami", "FL", "33132"), dest("117 W Duval St", "Jacksonville", "FL", "32202")],
  GA: [dest("55 Trinity Ave SW", "Atlanta", "GA", "30303"), dest("2 E Bay St", "Savannah", "GA", "31401")],
  HI: [dest("530 S King St", "Honolulu", "HI", "96813"), dest("101 Pauahi St", "Hilo", "HI", "96720")],
  ID: [dest("150 N Capitol Blvd", "Boise", "ID", "83702"), dest("308 Constitution Way", "Idaho Falls", "ID", "83402")],
  IL: [dest("121 N LaSalle St", "Chicago", "IL", "60602"), dest("300 S 7th St", "Springfield", "IL", "62701")],
  IN: [dest("200 E Washington St", "Indianapolis", "IN", "46204"), dest("1 E Main St", "Fort Wayne", "IN", "46802")],
  IA: [dest("400 Robert D Ray Dr", "Des Moines", "IA", "50309"), dest("101 1st St SE", "Cedar Rapids", "IA", "52401")],
  KS: [dest("455 N Main St", "Wichita", "KS", "67202"), dest("701 N 7th St", "Kansas City", "KS", "66101")],
  KY: [dest("527 W Jefferson St", "Louisville", "KY", "40202"), dest("200 E Main St", "Lexington", "KY", "40507")],
  LA: [dest("1300 Perdido St", "New Orleans", "LA", "70112"), dest("222 St Louis St", "Baton Rouge", "LA", "70802")],
  ME: [dest("389 Congress St", "Portland", "ME", "04101"), dest("73 Harlow St", "Bangor", "ME", "04401")],
  MD: [dest("100 Holliday St", "Baltimore", "MD", "21202"), dest("160 Duke of Gloucester St", "Annapolis", "MD", "21401")],
  MA: [dest("1 City Hall Square", "Boston", "MA", "02201"), dest("455 Main St", "Worcester", "MA", "01608")],
  MI: [dest("2 Woodward Ave", "Detroit", "MI", "48226"), dest("300 Monroe Ave NW", "Grand Rapids", "MI", "49503")],
  MN: [dest("350 S 5th St", "Minneapolis", "MN", "55415"), dest("411 W 1st St", "Duluth", "MN", "55802")],
  MS: [dest("219 S President St", "Jackson", "MS", "39201"), dest("1416 24th Ave", "Gulfport", "MS", "39501")],
  MO: [dest("414 E 12th St", "Kansas City", "MO", "64106"), dest("1200 Market St", "Saint Louis", "MO", "63103")],
  MT: [dest("210 N 27th St", "Billings", "MT", "59101"), dest("435 Ryman St", "Missoula", "MT", "59802")],
  NE: [dest("1819 Farnam St", "Omaha", "NE", "68183"), dest("555 S 10th St", "Lincoln", "NE", "68508")],
  NV: [dest("495 S Main St", "Las Vegas", "NV", "89101"), dest("1 E 1st St", "Reno", "NV", "89501")],
  NH: [dest("1 City Hall Plaza", "Manchester", "NH", "03101"), dest("41 Green St", "Concord", "NH", "03301")],
  NJ: [dest("920 Broad St", "Newark", "NJ", "07102"), dest("1301 Bacharach Blvd", "Atlantic City", "NJ", "08401")],
  NM: [dest("1 Civic Plaza NW", "Albuquerque", "NM", "87102"), dest("200 Lincoln Ave", "Santa Fe", "NM", "87501")],
  NY: [dest("350 5th Ave", "New York", "NY", "10118"), dest("65 Niagara Square", "Buffalo", "NY", "14202")],
  NC: [dest("600 E 4th St", "Charlotte", "NC", "28202"), dest("222 W Hargett St", "Raleigh", "NC", "27601")],
  ND: [dest("225 4th St N", "Fargo", "ND", "58102"), dest("221 N 5th St", "Bismarck", "ND", "58501")],
  OH: [dest("90 W Broad St", "Columbus", "OH", "43215"), dest("601 Lakeside Ave", "Cleveland", "OH", "44114")],
  OK: [dest("200 N Walker Ave", "Oklahoma City", "OK", "73102"), dest("175 E 2nd St", "Tulsa", "OK", "74103")],
  OR: [dest("1221 SW 4th Ave", "Portland", "OR", "97204"), dest("125 E 8th Ave", "Eugene", "OR", "97401")],
  PA: [dest("1400 John F Kennedy Blvd", "Philadelphia", "PA", "19107"), dest("414 Grant St", "Pittsburgh", "PA", "15219")],
  RI: [dest("25 Dorrance St", "Providence", "RI", "02903"), dest("43 Broadway", "Newport", "RI", "02840")],
  SC: [dest("80 Broad St", "Charleston", "SC", "29401"), dest("1737 Main St", "Columbia", "SC", "29201")],
  SD: [dest("224 W 9th St", "Sioux Falls", "SD", "57104"), dest("300 6th St", "Rapid City", "SD", "57701")],
  TN: [dest("1 Public Square", "Nashville", "TN", "37201"), dest("125 N Main St", "Memphis", "TN", "38103")],
  TX: [dest("700 Congress Ave", "Austin", "TX", "78701"), dest("1500 Marilla St", "Dallas", "TX", "75201")],
  UT: [dest("451 S State St", "Salt Lake City", "UT", "84111"), dest("351 W Center St", "Provo", "UT", "84601")],
  VT: [dest("149 Church St", "Burlington", "VT", "05401"), dest("39 Main St", "Montpelier", "VT", "05602")],
  VA: [dest("900 E Broad St", "Richmond", "VA", "23219"), dest("2401 Courthouse Dr", "Virginia Beach", "VA", "23456")],
  WA: [dest("600 4th Ave", "Seattle", "WA", "98104"), dest("808 W Spokane Falls Blvd", "Spokane", "WA", "99201")],
  WV: [dest("501 Virginia St E", "Charleston", "WV", "25301"), dest("389 Spruce St", "Morgantown", "WV", "26505")],
  WI: [dest("200 E Wells St", "Milwaukee", "WI", "53202"), dest("210 Martin Luther King Jr Blvd", "Madison", "WI", "53703")],
  WY: [dest("2101 O'Neil Ave", "Cheyenne", "WY", "82001"), dest("150 E Pearl Ave", "Jackson", "WY", "83001")],
}

function cityLabel(address: AddressFields): string {
  return `${address.city_locality}, ${address.state_province}`
}

function samePlace(
  origin: { city_locality: string; postal_code: string },
  destination: AddressFields,
): boolean {
  const originZip = origin.postal_code.replace(/\D/g, "").slice(0, 5)
  const destZip = destination.postal_code.replace(/\D/g, "").slice(0, 5)
  if (originZip && destZip && originZip === destZip) return true
  return origin.city_locality.trim().toLowerCase() === destination.city_locality.trim().toLowerCase()
}

function pickInState(origin: {
  city_locality: string
  state_province: string
  postal_code: string
}): AddressFields {
  const state = normalizeUsStateProvinceForShipping("US", origin.state_province)
  const pair = IN_STATE_CITIES[state]
  if (!pair) return CROSS_COUNTRY_WEST
  const [primary, secondary] = pair
  return samePlace(origin, primary) ? secondary : primary
}

function pickCrossCountry(origin: {
  city_locality: string
  state_province: string
  postal_code: string
}): AddressFields {
  const state = normalizeUsStateProvinceForShipping("US", origin.state_province)
  const preferred = WEST_ORIGIN_STATES.has(state) ? CROSS_COUNTRY_EAST : CROSS_COUNTRY_WEST
  if (samePlace(origin, preferred)) {
    return preferred.postal_code === CROSS_COUNTRY_EAST.postal_code
      ? CROSS_COUNTRY_WEST
      : CROSS_COUNTRY_EAST
  }
  return preferred
}

export function getOriginLaneDestinations(origin: {
  city_locality: string
  state_province: string
  postal_code: string
}): { inState: OriginLaneDestination; crossCountry: OriginLaneDestination } {
  const inStateShipTo = pickInState(origin)
  const crossCountryShipTo = pickCrossCountry(origin)
  return {
    inState: {
      lane: "in_state",
      sampleCityLabel: cityLabel(inStateShipTo),
      shipTo: inStateShipTo,
    },
    crossCountry: {
      lane: "cross_country",
      sampleCityLabel: cityLabel(crossCountryShipTo),
      shipTo: crossCountryShipTo,
    },
  }
}
