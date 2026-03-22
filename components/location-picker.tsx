"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Search, Crosshair, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

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
  initialCity?: string
  initialState?: string
  initialDisplay?: string
}

export function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialCity,
  initialState,
  initialDisplay,
}: LocationPickerProps) {
  const [lat, setLat] = useState(initialLat ?? 33.7701)
  const [lng, setLng] = useState(initialLng ?? -118.1937)
  const [city, setCity] = useState(initialCity ?? "")
  const [state, setState] = useState(initialState ?? "")
  const [displayName, setDisplayName] = useState(initialDisplay ?? "")
  const [searchQuery, setSearchQuery] = useState(initialDisplay ?? "")
  const [searching, setSearching] = useState(false)
  const [appliedSuccess, setAppliedSuccess] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<{ setView: (center: [number, number], zoom: number) => void } | null>(null)
  const markerRef = useRef<{ setLatLng: (latlng: [number, number]) => void } | null>(null)

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        )
        const data = await res.json()
        const addr = data.address || {}
        const resolvedCity =
          addr.city || addr.town || addr.village || addr.hamlet || initialCity || ""
        const resolvedState = addr.state || initialState || ""
        const display = [resolvedCity, resolvedState].filter(Boolean).join(", ")
        setCity(resolvedCity || addr.city || "")
        setState(resolvedState || addr.state || "")
        setDisplayName(display || data.display_name || "Unknown location")
      } catch {
        setCity("")
        setState("")
        setDisplayName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
      }
    },
    [initialCity, initialState]
  )

  function handleApplyLocation() {
    const display = displayName.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    onLocationSelect({
      lat,
      lng,
      city,
      state,
      displayName: display,
    })
    setSearchQuery(display)
    if (!displayName.trim()) setDisplayName(display)
    setAppliedSuccess(true)
    toast.success("Location saved", {
      description: display,
      duration: 3000,
    })
    setTimeout(() => setAppliedSuccess(false), 2500)
  }

  useEffect(() => {
    let mounted = true
    const el = mapRef.current
    if (!el) return

    async function init() {
      const L = (await import("leaflet")).default
      await import("leaflet/dist/leaflet.css")
      if (!mounted || !mapRef.current) return

      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 11,
        scrollWheelZoom: true,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OSM &copy; CARTO',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        html: `<div style="background:#111111;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
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
      setMapReady(true)

      if (!initialDisplay && !displayName) {
        reverseGeocode(lat, lng)
      }
    }
    init()
    return () => {
      mounted = false
      if (mapInstanceRef.current && "remove" in mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove?.()
        mapInstanceRef.current = null
      }
      markerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- init once

  async function handleSearch(e?: React.SyntheticEvent) {
    e?.preventDefault?.()
    setSearchError(null)
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      )
      const results = await res.json()
      if (results.length > 0) {
        const result = results[0]
        const newLat = parseFloat(result.lat)
        const newLng = parseFloat(result.lon)
        setLat(newLat)
        setLng(newLng)

        const map = mapInstanceRef.current
        const marker = markerRef.current
        if (map && marker) {
          map.setView([newLat, newLng], 12)
          marker.setLatLng([newLat, newLng])
        }

        const addr = result.address || {}
        const resolvedCity =
          addr.city || addr.town || addr.village || addr.hamlet || ""
        const resolvedState = addr.state || ""
        const display = [resolvedCity, resolvedState].filter(Boolean).join(", ")
        setCity(resolvedCity)
        setState(resolvedState)
        setDisplayName(display || result.display_name || "")
      } else {
        setSearchError("No places found. Try a different search or use the map.")
      }
    } catch {
      setSearchError("Search failed. Try again or pick a spot on the map.")
    } finally {
      setSearching(false)
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setSearchError("Location is not supported by your browser.")
      return
    }
    setSearchError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude
        const newLng = position.coords.longitude
        setLat(newLat)
        setLng(newLng)

        const map = mapInstanceRef.current
        const marker = markerRef.current
        if (map && marker) {
          map.setView([newLat, newLng], 13)
          marker.setLatLng([newLat, newLng])
        }
        reverseGeocode(newLat, newLng)
        setLocating(false)
      },
      () => {
        setSearchError("Could not get your location. Check permissions or search instead.")
        setLocating(false)
      }
    )
  }

  return (
    <div className="space-y-3">
      <Label>Pickup location</Label>
      <p className="text-sm text-muted-foreground">
        Search or click the map so buyers know the general area for pickup.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleSearch(e)
              }
            }}
            placeholder="City, address, beach, or ZIP..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={searching}
            onClick={() => handleSearch()}
            className="flex-1 sm:flex-none"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Search</span>
              </>
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
      </div>

      {searchError && (
        <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {searchError}
        </div>
      )}

      <Card className="overflow-hidden relative">
        <div
          ref={mapRef}
          className="h-[320px] w-full bg-muted"
          style={{ zIndex: 0 }}
        />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </Card>

      {displayName && (
        <Card className={`border transition-colors ${appliedSuccess ? "bg-primary/10 border-primary/30 ring-2 ring-primary/20" : "bg-primary/5 border-primary/20"}`}>
          <CardContent className="p-3 flex items-center gap-2">
            {appliedSuccess ? (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                {appliedSuccess ? "This location is saved to your listing." : "Search or click the map, then click Apply location to save"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        type="button"
        onClick={handleApplyLocation}
        className={`w-full sm:w-auto transition-all ${appliedSuccess ? "bg-black hover:bg-neutral-800 text-white" : ""}`}
      >
        {appliedSuccess ? (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Location saved
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4 mr-2" />
            Apply location
          </>
        )}
      </Button>
    </div>
  )
}
