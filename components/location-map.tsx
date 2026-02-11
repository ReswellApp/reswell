"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import L from "leaflet"

interface LocationMapProps {
  lat: number
  lng: number
  label?: string
  className?: string
}

export function LocationMap({ lat, lng, label, className }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [ready, setReady] = useState(false)
  const leafletLoaded = useRef(false)

  useEffect(() => {
    if (leafletLoaded.current) return
    leafletLoaded.current = true

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)

    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.onload = () => setReady(true)
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 11,
      scrollWheelZoom: false,
      dragging: true,
      zoomControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    // Approximate area circle instead of exact pin for privacy
    L.circle([lat, lng], {
      color: "#0891b2",
      fillColor: "#0891b2",
      fillOpacity: 0.15,
      radius: 2000,
      weight: 2,
    }).addTo(map)

    // Center marker
    const icon = L.divIcon({
      html: `<div style="background:#0891b2;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

    const marker = L.marker([lat, lng], { icon })
    if (label) {
      marker.bindPopup(`<strong>${label}</strong><br/>Approximate pickup area`)
    }
    marker.addTo(map)

    mapInstanceRef.current = map
  }, [ready, lat, lng, label])

  return (
    <div className={`relative overflow-hidden rounded-lg ${className || ""}`}>
      <div ref={mapRef} className="h-[200px] w-full bg-muted" style={{ zIndex: 0 }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
