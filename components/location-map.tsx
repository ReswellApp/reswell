"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LocationMapProps {
  lat: number
  lng: number
  label?: string
  className?: string
  /** Show a "Get directions" link (opens in Google Maps or system default) */
  showDirections?: boolean
  /** Map height in pixels (default 240) */
  height?: number
}

export function LocationMap({
  lat,
  lng,
  label,
  className = "",
  showDirections = true,
  height = 240,
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    const el = mapRef.current
    if (!el) return

    async function init() {
      const L = await import("leaflet")
      await import("leaflet/dist/leaflet.css")

      if (!mounted || !mapRef.current) return
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 12,
        scrollWheelZoom: true,
        dragging: true,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map)

      L.circle([lat, lng], {
        color: "#0891b2",
        fillColor: "#0891b2",
        fillOpacity: 0.2,
        radius: 1500,
        weight: 2,
      }).addTo(map)

      const icon = L.divIcon({
        html: `<div style="background:#0891b2;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      const marker = L.marker([lat, lng], { icon })
      if (label) {
        marker.bindPopup(`<strong>${escapeHtml(label)}</strong><br/><span style="font-size:12px;color:#666">Approximate pickup area</span>`)
      }
      marker.addTo(map)

      mapInstanceRef.current = map
      setReady(true)
    }

    init()
    return () => {
      mounted = false
      if (mapInstanceRef.current && typeof (mapInstanceRef.current as { remove: () => void }).remove === "function") {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  }, [lat, lng, label])

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <div
        ref={mapRef}
        className="w-full bg-muted"
        style={{ height: `${height}px`, zIndex: 0 }}
      />
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted"
          style={{ height: `${height}px` }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {showDirections && ready && (
        <div className="absolute bottom-3 left-3 right-3 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-md gap-1.5"
            asChild
          >
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              <MapPin className="h-3.5 w-3.5" />
              Get directions
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}

function escapeHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}
