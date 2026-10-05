"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  coastalCorridorLine,
  coastalMapPins,
  coastalPinDisplayPoint,
  coastalPinIcon,
} from "@/components/features/coastal-delivery/coastal-map-pins"
import type { CoastalCoverageStop, CoastalDashboardJob } from "@/lib/types/coastal-delivery"

const CORRIDOR_CENTER: [number, number] = [37.6, -122.4]

type LeafletMapHandle = {
  remove: () => void
  invalidateSize: () => void
  getSize: () => { x: number; y: number }
  setView: (latlng: [number, number], zoom?: number) => void
  fitBounds: (bounds: unknown, options?: { padding?: [number, number]; maxZoom?: number }) => void
  flyTo: (latlng: [number, number], zoom?: number, options?: { duration?: number }) => void
}

type LeafletMarker = {
  addTo: (map: LeafletMapHandle) => void
  on: (event: "click", handler: () => void) => void
  setIcon: (icon: unknown) => void
  setZIndexOffset: (offset: number) => void
}

type LeafletNamespace = {
  map: (
    el: HTMLElement,
    options: { center: [number, number]; zoom: number; scrollWheelZoom: boolean; dragging: boolean },
  ) => LeafletMapHandle
  tileLayer: (url: string, options: { attribution: string; maxZoom: number }) => { addTo: (map: LeafletMapHandle) => void }
  polyline: (
    latlngs: [number, number][],
    options: { color: string; weight: number; opacity: number },
  ) => { addTo: (map: LeafletMapHandle) => void }
  divIcon: (options: {
    html: string
    className: string
    iconSize: [number, number]
    iconAnchor: [number, number]
  }) => unknown
  marker: (latlng: [number, number], options: { icon: unknown; zIndexOffset?: number }) => LeafletMarker
  latLngBounds: (latlngs: [number, number][]) => unknown
}

interface CoastalShipperMapProps {
  coverage: CoastalCoverageStop[]
  jobs: CoastalDashboardJob[]
  selectedJobId: string | null
  onSelectJob: (jobId: string) => void
  emptyMessage: string | null
}

export function CoastalShipperMap({
  coverage,
  jobs,
  selectedJobId,
  onSelectJob,
  emptyMessage,
}: CoastalShipperMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMapHandle | null>(null)
  const leafletRef = useRef<LeafletNamespace | null>(null)
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map())
  const onSelectRef = useRef(onSelectJob)
  onSelectRef.current = onSelectJob
  const [ready, setReady] = useState(false)

  const pins = coastalMapPins(jobs, selectedJobId)
  const pinSignature = pins.map((pin) => `${pin.key}:${pin.latitude}:${pin.longitude}:${pin.kind}`).join("|")
  const coverageSignature = coverage.map((stop) => `${stop.id}:${stop.latitude}:${stop.longitude}`).join("|")
  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const skipInitialFocus = useRef(true)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    let mounted = true
    skipInitialFocus.current = true
    setReady(false)
    const el = mapElRef.current
    if (!el) return

    async function init() {
      const leaflet = (await import("leaflet")) as LeafletNamespace
      await import("leaflet/dist/leaflet.css")
      if (!mounted || !mapElRef.current) return

      const map = leaflet.map(mapElRef.current, {
        center: CORRIDOR_CENTER,
        zoom: 8,
        scrollWheelZoom: true,
        dragging: true,
      })
      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        })
        .addTo(map)

      const drawn = pinsRef.current
      const corridor = coastalCorridorLine(coverage)
      const bounds = [...corridor]
      if (corridor.length > 1) {
        leaflet.polyline(corridor, { color: "#111111", weight: 3, opacity: 0.45 }).addTo(map)
      }
      const markers = new Map<string, LeafletMarker>()
      for (const pin of drawn) {
        const at = coastalPinDisplayPoint(pin, drawn)
        bounds.push(at)
        const marker = leaflet.marker(at, {
          icon: coastalPinIcon(leaflet, pin, false),
          zIndexOffset: pin.role === "pickup" ? 200 : 100,
        })
        marker.on("click", () => onSelectRef.current(pin.jobId))
        marker.addTo(map)
        markers.set(pin.key, marker)
      }
      markersRef.current = markers
      leafletRef.current = leaflet
      mapRef.current = map

      let fitted = false
      const fit = () => {
        map.invalidateSize()
        const size = map.getSize()
        if (fitted || size.x < 40 || size.y < 40) return
        fitted = true
        if (bounds.length === 1) map.setView(bounds[0], 11)
        else if (bounds.length > 1) map.fitBounds(leaflet.latLngBounds(bounds), { padding: [32, 32], maxZoom: 11 })
      }
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = new ResizeObserver(() => fit())
      if (mapElRef.current) resizeObserverRef.current.observe(mapElRef.current)
      fit()
      if (mounted) setReady(true)
    }

    void init()
    return () => {
      mounted = false
      markersRef.current = new Map()
      leafletRef.current = null
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Redraw when the stops or job pins change, not when the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSignature, coverageSignature])

  useEffect(() => {
    const leaflet = leafletRef.current
    const map = mapRef.current
    if (!leaflet || !map || !ready) return
    const drawn = pinsRef.current
    for (const pin of drawn) {
      const marker = markersRef.current.get(pin.key)
      if (!marker) continue
      const selected = pin.jobId === selectedJobId
      marker.setIcon(coastalPinIcon(leaflet, pin, selected))
      marker.setZIndexOffset(selected ? 500 : pin.role === "pickup" ? 200 : 100)
    }
    const focus = drawn.find((pin) => pin.focus)
    if (skipInitialFocus.current) {
      skipInitialFocus.current = false
      return
    }
    if (!focus) return
    map.flyTo(coastalPinDisplayPoint(focus, drawn), 12, { duration: 0.45 })
  }, [ready, selectedJobId, pinSignature])

  return (
    <div className="relative h-full min-h-[280px] overflow-hidden bg-muted">
      <div ref={mapElRef} className="z-0 h-full min-h-[280px] w-full" />
      {emptyMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 px-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : null}
      {!ready && !emptyMessage ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  )
}

