"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { coastalCorridorLine } from "@/components/features/coastal-delivery/coastal-map-pins"
import type { CoastalCoverageStop } from "@/lib/types/coastal-delivery"

const CORRIDOR_CENTER: [number, number] = [37.6, -122.4]

type LeafletMapHandle = {
  remove: () => void
  invalidateSize: () => void
  getSize: () => { x: number; y: number }
  setView: (latlng: [number, number], zoom?: number) => void
  fitBounds: (bounds: unknown, options?: { padding?: [number, number]; maxZoom?: number }) => void
}

type LeafletMarker = {
  addTo: (map: LeafletMapHandle) => void
  setIcon: (icon: unknown) => void
  bindTooltip: (label: string, options: { direction: string; offset: [number, number] }) => void
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
  marker: (latlng: [number, number], options: { icon: unknown }) => LeafletMarker
  latLngBounds: (latlngs: [number, number][]) => unknown
}

interface ShipperCoverageMapProps {
  coverage: CoastalCoverageStop[]
  highlightedIds: string[]
}

export function ShipperCoverageMap({ coverage, highlightedIds }: ShipperCoverageMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMapHandle | null>(null)
  const leafletRef = useRef<LeafletNamespace | null>(null)
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map())
  const highlightedRef = useRef(highlightedIds)
  highlightedRef.current = highlightedIds
  const [ready, setReady] = useState(false)
  const coverageSignature = coverage.map((stop) => `${stop.id}:${stop.latitude}:${stop.longitude}`).join("|")
  const highlightSignature = highlightedIds.join("|")

  useEffect(() => {
    let mounted = true
    let observer: ResizeObserver | null = null
    setReady(false)
    const el = mapElRef.current
    if (!el || coverage.length === 0) return

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
      if (!mounted) {
        map.remove()
        return
      }
      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        })
        .addTo(map)

      const corridor = coastalCorridorLine(coverage)
      if (corridor.length > 1) {
        leaflet.polyline(corridor, { color: "#111111", weight: 3, opacity: 0.45 }).addTo(map)
      }
      const markers = new Map<string, LeafletMarker>()
      const highlighted = new Set(highlightedRef.current)
      for (const stop of coverage) {
        const marker = leaflet.marker([stop.latitude, stop.longitude], {
          icon: stopIcon(leaflet, highlighted.has(stop.id)),
        })
        marker.bindTooltip(stop.name, { direction: "top", offset: [0, -8] })
        marker.addTo(map)
        markers.set(stop.id, marker)
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
        if (corridor.length === 1) map.setView(corridor[0], 11)
        else if (corridor.length > 1) map.fitBounds(leaflet.latLngBounds(corridor), { padding: [32, 32], maxZoom: 11 })
      }
      observer = new ResizeObserver(() => fit())
      if (mapElRef.current) observer.observe(mapElRef.current)
      fit()
      if (mounted) setReady(true)
    }

    void init()
    return () => {
      mounted = false
      observer?.disconnect()
      markersRef.current = new Map()
      leafletRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Redraw when the covered stops change. Selection only swaps icons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverageSignature])

  useEffect(() => {
    const leaflet = leafletRef.current
    if (!leaflet || !ready) return
    const highlighted = new Set(highlightedIds)
    for (const stop of coverage) {
      markersRef.current.get(stop.id)?.setIcon(stopIcon(leaflet, highlighted.has(stop.id)))
    }
  }, [ready, highlightSignature, coverage, highlightedIds])

  if (coverage.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center bg-muted px-6 text-center text-sm text-muted-foreground">
        Stops on this account have no map coordinates.
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[280px] overflow-hidden bg-muted">
      <div ref={mapElRef} className="z-0 h-full min-h-[280px] w-full" />
      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  )
}

function stopIcon(leaflet: LeafletNamespace, selected: boolean) {
  const size = selected ? 16 : 12
  const fill = selected ? "#111111" : "#ffffff"
  return leaflet.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${fill};border:2px solid #111111;box-shadow:0 1px 4px rgba(0,0,0,0.25);"></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}
