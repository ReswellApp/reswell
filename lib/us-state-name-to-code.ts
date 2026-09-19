/** Lowercase full / common US state & territory names → USPS code (for matching `listings.state`). */
export const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  "washington dc": "DC",
  "washington d.c.": "DC",
  "puerto rico": "PR",
  guam: "GU",
  "american samoa": "AS",
  "northern mariana islands": "MP",
  "u.s. virgin islands": "VI",
  "united states virgin islands": "VI",
  "virgin islands": "VI",
  "armed forces americas": "AA",
  "armed forces europe": "AE",
  "armed forces pacific": "AP",
}

/** APO / FPO / DPO military states — valid USPS codes, not in the 50-state list. */
const USPS_MILITARY_STATE_CODES = new Set(["AA", "AE", "AP"])

const USPS_STATE_PROVINCE_CODES = new Set<string>([
  ...Object.values(US_STATE_NAME_TO_CODE),
  ...USPS_MILITARY_STATE_CODES,
])

/** True for a 2-letter USPS state, territory, or military code. */
export function isUspsStateProvinceCode(code: string | null | undefined): boolean {
  const c = (code ?? "").trim().toUpperCase()
  return c.length === 2 && USPS_STATE_PROVINCE_CODES.has(c)
}

/** First canonical lowercase name for each USPS code (CA → "california"). */
export const US_STATE_CODE_TO_NAME: Record<string, string> = {}
for (const [name, code] of Object.entries(US_STATE_NAME_TO_CODE)) {
  if (US_STATE_CODE_TO_NAME[code] == null) {
    US_STATE_CODE_TO_NAME[code] = name
  }
}

/** Title-case state name for a USPS code (`CA` → `California`). */
export function usStateTitleCaseName(code: string): string | null {
  const name = US_STATE_CODE_TO_NAME[code.trim().toUpperCase()]
  if (!name) return null
  return name.replace(/\b([a-z])/g, (ch) => ch.toUpperCase())
}

/**
 * ShipEngine and many US carrier APIs require `state_province` to be a 2-letter USPS code when
 * `country_code` is US. Geocoders often return full names (e.g. "California").
 */
export function normalizeUsStateProvinceForShipping(
  countryCode: string,
  stateProvince: string,
): string {
  const cc = countryCode.trim().toUpperCase()
  const s = stateProvince.trim()
  if (cc !== "US" || !s) return s
  if (s.length <= 2) return s.slice(0, 2).toUpperCase()
  return US_STATE_NAME_TO_CODE[s.toLowerCase()] ?? s
}
