import { NextRequest, NextResponse } from "next/server"

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en",
  "User-Agent": "ReswellSurfMarketplace/1",
}

/** POI classes Nominatim returns for queries like "santa bar" (bars) — not useful for city/ZIP pickers. */
const DISALLOWED_NOMINATIM_CLASSES = new Set([
  "amenity",
  "shop",
  "tourism",
  "office",
  "leisure",
  "railway",
  "highway",
  "historic",
  "craft",
  "sport",
  "aeroway",
  "emergency",
  "healthcare",
  "man_made",
  "building",
])

type NominatimHit = {
  lat: string
  lon: string
  class?: string
  display_name?: string
  name?: string
  importance?: number
  address?: {
    city?: string
    town?: string
    village?: string
    hamlet?: string
    municipality?: string
    state?: string
    postcode?: string
  }
}

type PhotonFeature = {
  geometry?: { type?: string; coordinates?: [number, number] }
  properties?: Record<string, unknown>
}

function labelForHit(hit: NominatimHit): string {
  const addr = hit.address
  if (addr) {
    const place =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.hamlet ||
      addr.municipality ||
      hit.name
    const state = addr.state
    if (place && state) return `${place}, ${state}`
    if (place) return place
  }
  if (hit.display_name) {
    const parts = hit.display_name.split(",").map((s) => s.trim())
    return parts.slice(0, 3).join(", ")
  }
  return hit.name || "Unknown"
}

function nominatimIsGeographic(hit: NominatimHit & { class?: string }): boolean {
  const c = hit.class ?? ""
  if (DISALLOWED_NOMINATIM_CLASSES.has(c)) return false
  return true
}

/** Split query into match tokens (skip 1-letter crumbs; ZIP fragments stay as digits). */
function queryTokens(raw: string): string[] {
  const q = raw.trim().toLowerCase()
  const parts = q.split(/\s+/).filter(Boolean)
  const tokens: string[] = []
  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      if (p.length >= 2) tokens.push(p)
    } else if (p.length >= 2) {
      tokens.push(p)
    }
  }
  if (tokens.length === 0 && q.length >= 2) tokens.push(q)
  return tokens
}

function normalizeWords(haystack: string): string[] {
  return haystack
    .toLowerCase()
    .replace(/,\s*/g, " ")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Each typed token must appear in the result text (so "santa bar" requires both, matching "Barbara" for "bar").
 * - 2-letter alpha: whole word or prefix of a word length ≥3 ("ca" → California, not Chicago).
 */
function tokenMatches(haystack: string, token: string): boolean {
  const t = token.toLowerCase()
  if (/^\d+$/.test(t)) return haystack.toLowerCase().includes(t)
  if (t.length < 2) return true
  const h = haystack.toLowerCase()
  if (t.length >= 3) return h.includes(t)
  const words = normalizeWords(haystack)
  return words.some((w) => w === t || (w.length >= 3 && w.startsWith(t)))
}

function matchesAllTokens(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  return tokens.every((t) => tokenMatches(haystack, t))
}

function rankSuggestion(
  haystack: string,
  phrase: string,
  tokens: string[],
  label: string,
  importance: number,
): number {
  const h = haystack.toLowerCase()
  const p = phrase.trim().toLowerCase()
  let score = 0
  if (p.length >= 2 && h.includes(p)) score += 1_000_000
  const primary = label.toLowerCase().split(",")[0]?.trim() ?? ""
  const first = tokens[0] ?? ""
  if (first && primary.startsWith(first)) score += 500_000
  else if (first && primary.includes(first)) score += 200_000
  for (const t of tokens) {
    const idx = h.indexOf(t)
    if (idx >= 0) score += 10_000 - Math.min(idx, 9999)
  }
  score += Math.max(0, importance || 0) * 100
  return score
}

type ParsedHit = {
  label: string
  lat: number
  lng: number
  haystack: string
  importance: number
  city: string
  state: string
}

function nominatimCityState(hit: NominatimHit): { city: string; state: string } {
  const addr = hit.address || {}
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.municipality ||
    (typeof hit.name === "string" ? hit.name.trim() : "") ||
    ""
  const state = addr.state || ""
  return { city, state }
}

function parseNominatimHits(data: (NominatimHit & { class?: string })[]): ParsedHit[] {
  return data
    .filter((hit) => hit.lat && hit.lon && nominatimIsGeographic(hit))
    .map((hit) => {
      const label = labelForHit(hit)
      const display = hit.display_name ?? ""
      const haystack = `${display} ${label}`.toLowerCase()
      const { city, state } = nominatimCityState(hit)
      return {
        label,
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        haystack,
        importance: typeof hit.importance === "number" ? hit.importance : 0,
        city,
        state,
      }
    })
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
}

async function fetchNominatimParsed(q: string): Promise<ParsedHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "30")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("countrycodes", "us")
  url.searchParams.set("dedupe", "1")
  const res = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
    next: { revalidate: 86_400 },
  })
  if (!res.ok) return []
  const data = (await res.json()) as (NominatimHit & { class?: string })[]
  if (!Array.isArray(data)) return []
  return parseNominatimHits(data)
}

function photonTypeWeight(type: string): number {
  switch (type) {
    case "city":
      return 1
    case "town":
      return 0.92
    case "village":
      return 0.88
    case "locality":
      return 0.85
    case "district":
      return 0.8
    case "neighbourhood":
      return 0.72
    case "county":
      return 0.55
    case "state":
      return 0.45
    default:
      return 0.38
  }
}

function photonLabel(p: Record<string, unknown>): string {
  const name = String(p.name ?? "").trim()
  const city = String(p.city ?? "").trim()
  const state = String(p.state ?? "").trim()
  const county = String(p.county ?? "").trim()
  const locality = name || city
  if (locality && state) {
    if (name && city && name.toLowerCase() !== city.toLowerCase()) {
      return `${name}, ${city}, ${state}`
    }
    return `${locality}, ${state}`
  }
  if (locality && county) return `${locality}, ${county}`
  return locality || county || state || "Unknown"
}

function photonRowAllowed(p: Record<string, unknown>): boolean {
  const cc = String(p.countrycode ?? "").toUpperCase()
  if (cc && cc !== "US") return false
  const t = String(p.type ?? "")
  if (t === "house" || t === "street") return false
  return true
}

function parsePhotonFeatures(features: PhotonFeature[]): ParsedHit[] {
  const out: ParsedHit[] = []
  for (const f of features) {
    const p = f.properties
    if (!p || !photonRowAllowed(p)) continue
    const coords = f.geometry?.coordinates
    if (!coords || coords.length < 2) continue
    const [lng, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const label = photonLabel(p)
    const haystack = [p.name, p.city, p.state, p.street, p.county, p.postcode, p.country, label]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    const pCity = String(p.city ?? "").trim()
    const pState = String(p.state ?? "").trim()
    const pName = String(p.name ?? "").trim()
    const pType = String(p.type ?? "")
    const city =
      pCity ||
      (pType === "city" || pType === "town" || pType === "village" ? pName : "") ||
      pName
    out.push({
      label,
      lat,
      lng,
      haystack,
      importance: photonTypeWeight(pType),
      city,
      state: pState,
    })
  }
  return out
}

/**
 * Photon (Komoot) fuzzy search is built for typeahead; Nominatim often returns only POIs for strings like "santa bar".
 * Scoped to continental US via bbox (aligned with `countrycodes=us`).
 */
async function fetchPhotonParsed(q: string): Promise<ParsedHit[]> {
  const url = new URL("https://photon.komoot.io/api/")
  url.searchParams.set("q", q)
  url.searchParams.set("limit", "30")
  url.searchParams.set("lang", "en")
  url.searchParams.set("bbox", "-125.0,24.0,-65.0,50.0")
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "ReswellSurfMarketplace/1" },
    next: { revalidate: 86_400 },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { features?: PhotonFeature[] }
  if (!Array.isArray(data.features)) return []
  return parsePhotonFeatures(data.features)
}

function isZipOrNumericQuery(q: string): boolean {
  const t = q.trim().replace(/[\s-]/g, "")
  return t.length >= 3 && /^\d+$/.test(t)
}

function finalizePool(parsed: ParsedHit[], tokens: string[]): ParsedHit[] {
  const keywordFiltered = parsed.filter((row) => matchesAllTokens(row.haystack, tokens))
  if (keywordFiltered.length > 0) return keywordFiltered
  if (tokens.length >= 2) return []
  return parsed
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim()
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }
  if (q.length > 200) {
    return NextResponse.json({ suggestions: [] })
  }

  const tokens = queryTokens(q)
  const phrase = q.trim().toLowerCase()

  try {
    let parsed: ParsedHit[] = []

    if (isZipOrNumericQuery(q)) {
      parsed = await fetchNominatimParsed(q)
    } else {
      parsed = await fetchPhotonParsed(q)
      const keywordOk = parsed.some((row) => matchesAllTokens(row.haystack, tokens))
      if (!keywordOk) {
        parsed = await fetchNominatimParsed(q)
      }
    }

    const pool = finalizePool(parsed, tokens)

    const ranked = pool
      .map((row) => ({
        row,
        rank: rankSuggestion(row.haystack, phrase, tokens, row.label, row.importance),
      }))
      .sort((a, b) => b.rank - a.rank)

    const suggestions = ranked.map((r) => ({
      label: r.row.label,
      lat: r.row.lat,
      lng: r.row.lng,
      city: r.row.city,
      state: r.row.state,
    }))

    const seen = new Set<string>()
    const unique = suggestions.filter((s) => {
      const k = s.label.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    const top = unique.slice(0, 8)

    return NextResponse.json(
      { suggestions: top },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
        },
      },
    )
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
