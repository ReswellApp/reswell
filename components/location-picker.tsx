"use client"

import React from "react"
import { useState, useRef, useCallback, useEffect } from "react"

declare const L: any
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Search, Crosshair, Loader2 } from "lucide-react"

interface LocationPickerProps {
  onLocationSelect: (location: {
    lat: number
    lng: number
    city: string
    state: string
    displayName: string
  }) => void
  initialLat?: number
  initialLng?: number
  initialDisplay?: string
}

export function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialDisplay,
}: LocationPickerProps) {
  const [lat, setLat] = useState(initialLat || 33.7701)
  const [lng, setLng] = useState(initialLng || -118.1937)
  const [displayName, setDisplayName] = useState(initialDisplay || "")
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const leafletLoaded = useRef(false)

  // Reverse geocode to get city/state from coordinates
  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        )
        const data = await res.json()
        const addr = data.address || {}
        const city =
          addr.city || addr.town || addr.village || addr.hamlet || ""
        const state = addr.state || ""
        const display = [city, state].filter(Boolean).join(", ")
        setDisplayName(display || data.display_name || "Unknown location")
        onLocationSelect({
          lat: latitude,
          lng: longitude,
          city,
          state,
          displayName: display || data.display_name || "",
        })
      } catch {
        setDisplayName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        onLocationSelect({
          lat: latitude,
          lng: longitude,
          city: "",
          state: "",
          displayName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        })
      }
    },
    [onLocationSelect]
  )

  // Load Leaflet dynamically
  useEffect(() => {
    if (leafletLoaded.current) return
    leafletLoaded.current = true

    // Add Leaflet CSS
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)

    // Add Leaflet JS
    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.onload = () => {
      setMapReady(true)
    }
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Initialize map when Leaflet is loaded
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 10,
      scrollWheelZoom: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    // Custom marker icon
    const icon = L.divIcon({
      html: `<div style="background:#0891b2;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    })

    const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map)

    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      setLat(pos.lat)
      setLng(pos.lng)
      reverseGeocode(pos.lat, pos.lng)
    })

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: newLat, lng: newLng } = e.latlng
      marker.setLatLng([newLat, newLng])
      setLat(newLat)
      setLng(newLng)
      reverseGeocode(newLat, newLng)
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    // Reverse geocode initial position if no display name set
    if (!initialDisplay) {
      reverseGeocode(lat, lng)
    }
  }, [mapReady, lat, lng, reverseGeocode, initialDisplay])

  // Search location by name
  async function handleSearch(e?: React.SyntheticEvent) {
    e?.preventDefault?.()
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      )
      const results = await res.json()
      if (results.length > 0) {
        const result = results[0]
        const newLat = parseFloat(result.lat)
        const newLng = parseFloat(result.lon)
        setLat(newLat)
        setLng(newLng)

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 12)
          markerRef.current.setLatLng([newLat, newLng])
        }

        const addr = result.address || {}
        const city =
          addr.city || addr.town || addr.village || addr.hamlet || ""
        const state = addr.state || ""
        const display = [city, state].filter(Boolean).join(", ")
        setDisplayName(display || result.display_name || "")
        onLocationSelect({
          lat: newLat,
          lng: newLng,
          city,
          state,
          displayName: display || result.display_name || "",
        })
      } else {
        // No results found
      }
    } catch {
      // Search failed silently
    } finally {
      setSearching(false)
    }
  }

  // Use browser geolocation
  function handleUseMyLocation() {
    if (!navigator.geolocation) return

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude
        const newLng = position.coords.longitude
        setLat(newLat)
        setLng(newLng)

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 12)
          markerRef.current.setLatLng([newLat, newLng])
        }

        reverseGeocode(newLat, newLng)
        setLocating(false)
      },
      () => {
        setLocating(false)
      }
    )
  }

  return (
    <div className="space-y-3">
      <Label>Pickup Location</Label>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(e); } }}
            placeholder="Search city, address, or ZIP..."
            className="pl-10"
          />
        </div>
        <Button type="button" variant="outline" disabled={searching} onClick={handleSearch}>
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleUseMyLocation}
          disabled={locating}
          title="Use my current location"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <div
          ref={mapRef}
          className="h-[300px] w-full bg-muted"
          style={{ zIndex: 0 }}
        />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </Card>

      {/* Selected location display */}
      {displayName && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                Click the map or drag the pin to adjust
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
