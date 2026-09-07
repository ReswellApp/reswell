"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import type { PickupOnlyLocality } from "@/lib/types/pickupOnlySurfboards"
import { PICKUP_AD_RADIUS_MILES } from "@/lib/types/pickupOnlySurfboards"

const AD_RADIUS_METERS = PICKUP_AD_RADIUS_MILES * 1609.344
const US_CENTER: [number, number] = [39.8, -98.5]

type LeafletMapHandle = {
  remove: () => void
  invalidateSize: () => void
  setView: (latlng: [number, number], zoom?: number) => void
  fitBounds: (bounds: unknown, options?: { padding?: [number, number]; maxZoom?: number }) => void
  flyTo: (latlng: [number, number], zoom?: number, options?: { duration?: number }) => void
}

type LeafletCircleHandle = { remove: () => void }

type PickupOnlySurfboardsMapProps = {
  localities: PickupOnlyLocality[]
  selectedKey: string | null
  onSelect: (key: string) => void
}

type LeafletCircleApi = {
  circle: (
    latlng: [number, number],
    options: {
      color: string
      fillColor: string
      fillOpacity: number
      radius: number
      weight: number
    },
  ) => LeafletCircleHandle & { addTo: (map: LeafletMapHandle) => void }
}

function mappedSignature(localities: PickupOnlyLocality[]): string {
  return localities
    .filter((loc) => loc.latitude != null && loc.longitude != null)
    .map((loc) => `${loc.key}:${loc.listingCount}:${loc.latitude}:${loc.longitude}`)
    .join("|")
}

export function PickupOnlySurfboardsMap({
  localities,
  selectedKey,
  onSelect,
}: PickupOnlySurfboardsMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMapHandle | null>(null)
  const circleRef = useRef<LeafletCircleHandle | null>(null)
  const leafletRef = useRef<unknown>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const [ready, setReady] = useState(false)
  const pinSignature = mappedSignature(localities)

  const mapped = useMemo(
    () =>
      localities.filter(
        (loc) =>
          loc.latitude != null &&
          loc.longitude != null &&
          Number.isFinite(loc.latitude) &&
          Number.isFinite(loc.longitude),
      ),
    [localities],
  )

  useEffect(() => {
    let mounted = true
    setReady(false)
    const el = mapElRef.current
    if (!el) return

    async function init() {
      const L = await import("leaflet")
      await import("leaflet/dist/leaflet.css")
      if (!mounted || !mapElRef.current) return

      leafletRef.current = L
      const map = L.map(mapElRef.current, {
        center: US_CENTER,
        zoom: 4,
        scrollWheelZoom: true,
        dragging: true,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map)

      const bounds: [number, number][] = []
      for (const loc of mapped) {
        const lat = loc.latitude as number
        const lng = loc.longitude as number
        bounds.push([lat, lng])
        const count = loc.listingCount
        const size = count >= 8 ? 36 : count >= 3 ? 30 : 26
        const icon = L.divIcon({
          html: `<div style="background:#111;color:#fff;width:${size}px;height:${size}px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;line-height:1;">${count}</div>`,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        })
        const marker = L.marker([lat, lng], { icon })
        const key = loc.key
        marker.bindPopup(
          `<strong>${escapeHtml(loc.label)}</strong><br/><span style="font-size:12px;color:#666">${count} pickup-only board${count === 1 ? "" : "s"}</span>`,
        )
        marker.on("click", () => onSelectRef.current(key))
        marker.addTo(map)
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], 9)
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 })
      }

      mapInstanceRef.current = map as LeafletMapHandle
      requestAnimationFrame(() => map.invalidateSize())
      if (mounted) setReady(true)
    }

    init()
    return () => {
      mounted = false
      circleRef.current?.remove()
      circleRef.current = null
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      leafletRef.current = null
    }
    // pinSignature captures mapped coords/counts; `mapped` is read on init only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSignature])

  const selected = mapped.find((loc) => loc.key === selectedKey) ?? null
  const selectedLat = selected?.latitude ?? null
  const selectedLng = selected?.longitude ?? null

  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletRef.current as LeafletCircleApi | null
    if (!map || !L || !ready) return

    circleRef.current?.remove()
    circleRef.current = null

    if (selectedLat == null || selectedLng == null) return

    const circle = L.circle([selectedLat, selectedLng], {
      color: "#111111",
      fillColor: "#111111",
      fillOpacity: 0.08,
      radius: AD_RADIUS_METERS,
      weight: 1.5,
    })
    circle.addTo(map)
    circleRef.current = circle
    map.flyTo([selectedLat, selectedLng], 9, { duration: 0.6 })
  }, [ready, selectedLat, selectedLng])

  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <div ref={mapElRef} className="z-0 h-[480px] w-full bg-muted" />
      {mapped.length === 0 ? (
        <div className="absolute inset-0 flex h-[480px] items-center justify-center bg-muted/80 px-6 text-center text-sm text-muted-foreground">
          No coordinates on these listings yet — use the city list to target ads from city/state text.
        </div>
      ) : null}
      {!ready && mapped.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 flex h-[480px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  )
}

function escapeHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}
