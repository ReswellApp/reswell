"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, Loader2 } from "lucide-react"
import type { TrackingMapPoint } from "@/lib/shipping/tracking-map-points"
import { trackingMapDirectionsUrl } from "@/lib/shipping/tracking-map-points"

export function TrackingRouteMap({
  points,
  className,
}: {
  points: TrackingMapPoint[]
  className?: string
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<{ remove: () => void } | null>(null)
  const pointsRef = useRef(points)
  pointsRef.current = points
  const [ready, setReady] = useState(false)
  const signature = points.map((point) => `${point.latitude},${point.longitude}`).join("|")
  const openUrl = trackingMapDirectionsUrl(points)

  useEffect(() => {
    let mounted = true
    const currentPoints = pointsRef.current
    const el = mapRef.current
    if (!el || currentPoints.length === 0) return

    async function init() {
      const L = await import("leaflet")
      await import("leaflet/dist/leaflet.css")
      if (!mounted || !mapRef.current) return

      const map = L.map(mapRef.current, {
        scrollWheelZoom: false,
        attributionControl: false,
      })
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 18,
      }).addTo(map)

      const latLngs = currentPoints.map((point) => [point.latitude, point.longitude] as [number, number])
      if (latLngs.length > 1) {
        L.polyline(latLngs, { color: "#355185", weight: 4, opacity: 0.9 }).addTo(map)
      }
      const start = latLngs[0]
      const end = latLngs[latLngs.length - 1]
      if (start) {
        L.circleMarker(start, { radius: 6, color: "#04070E", weight: 2, fillColor: "#FFFFFF", fillOpacity: 1 }).addTo(
          map,
        )
      }
      if (end) {
        L.circleMarker(end, { radius: 7, color: "#355185", weight: 2, fillColor: "#355185", fillOpacity: 1 }).addTo(
          map,
        )
      }
      if (latLngs.length === 1 && start) map.setView(start, 7)
      else map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24], maxZoom: 8 })

      mapInstanceRef.current = map
      setReady(true)
    }

    void init()
    return () => {
      mounted = false
      setReady(false)
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [signature])

  if (points.length === 0) return null

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg border border-border/70">
        <div ref={mapRef} className="h-44 w-full bg-muted" />
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : null}
      </div>
      {openUrl ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Open in Maps
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
    </div>
  )
}
