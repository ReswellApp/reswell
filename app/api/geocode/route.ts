import { NextRequest, NextResponse } from "next/server"

import {
  getGoogleGeocodingApiKey,
  googleForwardGeocode,
  googleReverseGeocodeLabel,
} from "@/lib/maps/google-geocoding-server"

const NOMINATIM_HEADERS = { Accept: "application/json", "User-Agent": "ReswellSurfMarketplace/1" }

/** Reverse geocode: lat/lng -> display name (e.g. "San Diego, CA"). */
async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("format", "json")
  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
  if (!res.ok) return null
  const data = await res.json()
  const addr = data?.address
  if (!addr) return null
  const city = addr.city || addr.town || addr.village || addr.municipality || ""
  const state = addr.state || addr.county || ""
  const parts = [city, state].filter(Boolean)
  return parts.length ? parts.join(", ") : null
}

/** Resolve a place name or ZIP to lat/lng using OpenStreetMap Nominatim (no API key). */
async function forwardGeocodeNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
  if (!res.ok) return null

  const data = await res.json()
  const first = Array.isArray(data) ? data[0] : null
  if (!first?.lat || !first?.lon) return null

  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()
  const latParam = searchParams.get("lat")
  const lngParam = searchParams.get("lng")

  // Reverse geocode: lat,lng -> display name
  if (latParam != null && lngParam != null) {
    const lat = Number(latParam)
    const lng = Number(lngParam)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "Invalid lat or lng" }, { status: 400 })
    }

    if (getGoogleGeocodingApiKey()) {
      const displayName = await googleReverseGeocodeLabel(lat, lng)
      if (displayName) {
        return NextResponse.json({ lat, lng, displayName })
      }
    }

    const displayName = await reverseGeocodeNominatim(lat, lng)
    return NextResponse.json({ lat, lng, displayName: displayName || `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
  }

  // Forward geocode: place name -> lat,lng
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Missing or short query" }, { status: 400 })
  }

  if (getGoogleGeocodingApiKey()) {
    const g = await googleForwardGeocode(q)
    if (g) {
      return NextResponse.json({ lat: g.lat, lng: g.lng })
    }
  }

  const nom = await forwardGeocodeNominatim(q)
  if (!nom) {
    return NextResponse.json({ error: "No result" }, { status: 404 })
  }

  return NextResponse.json({
    lat: nom.lat,
    lng: nom.lng,
  })
}
