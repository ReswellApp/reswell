/**
 * Marketplace-style location chip: "Los Angeles, CA".
 * Empty input stays "Location". Same rules as website `boardsBrowseLocationButtonLabel`.
 */
export function locationButtonLabel(location: string): string {
  const trimmed = location.trim()
  if (!trimmed) return "Location"
  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  const city = parts[0]
  if (!city) return "Location"
  const region = parts[1]
  if (!region) return city
  if (/^(USA|US|United States)$/i.test(region)) return city
  const code = region.length === 2 ? region.toUpperCase() : uspsCode(region)
  return code ? `${city}, ${code}` : `${city}, ${region}`
}

export function locationFilterDetail(label: string | undefined, radius: string): string {
  const trimmed = label?.trim() ?? ""
  if (!trimmed) return "None selected"
  const place = locationButtonLabel(trimmed)
  if (radius === "any") return place
  return `${place} · ${radius} mi`
}

function uspsCode(region: string): string | undefined {
  return US_STATE_NAME_TO_CODE[region.toLowerCase()]
}

const US_STATE_NAME_TO_CODE: Record<string, string> = {
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
}
