"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  coastalCorridorLine,
  coastalMapPins,
  coastalPinDisplayPoint,
  coastalPinMarkerIcon,
  type CoastalMapPin,
} from "@/components/features/coastal-delivery/coastal-map-pins"
import { loadGoogleMaps } from "@/lib/maps/load-google-maps"
import type { CoastalCoverageStop, CoastalDashboardJob } from "@/lib/types/coastal-delivery"

const CORRIDOR_CENTER: google.maps.LatLngLiteral = { lat: 37.6, lng: -122.4 }
const FIT_PADDING = 32
const FIT_MAX_ZOOM = 11
const FOCUS_ZOOM = 12

interface CoastalShipperMapProps {
  coverage: CoastalCoverageStop[]
  jobs: CoastalDashboardJob[]
  selectedJobId: string | null
  onSelectJob: (jobId: string) => void
  emptyMessage: string | null
}

function mapLoadMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ""
  if (message.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set")) {
    return "Google Maps is not configured."
  }
  return "Map could not load."
}

function toLatLng(point: [number, number]): google.maps.LatLngLiteral {
  return { lat: point[0], lng: point[1] }
}

function markerIcon(maps: typeof google.maps, pin: CoastalMapPin, selected: boolean): google.maps.Icon {
  const { url, size } = coastalPinMarkerIcon(pin, selected)
  const px = new maps.Size(size, size)
  return {
    url,
    size: px,
    scaledSize: px,
    anchor: new maps.Point(size / 2, size / 2),
  }
}

export function CoastalShipperMap({
  coverage,
  jobs,
  selectedJobId,
  onSelectJob,
  emptyMessage,
}: CoastalShipperMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const mapsRef = useRef<typeof google.maps | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const onSelectRef = useRef(onSelectJob)
  onSelectRef.current = onSelectJob
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const pins = coastalMapPins(jobs, selectedJobId)
  const pinSignature = pins.map((pin) => `${pin.key}:${pin.latitude}:${pin.longitude}:${pin.kind}`).join("|")
  const coverageSignature = coverage.map((stop) => `${stop.id}:${stop.latitude}:${stop.longitude}`).join("|")
  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const coverageRef = useRef(coverage)
  coverageRef.current = coverage
  const skipInitialFocus = useRef(true)
  const fitToken = useRef(0)

  useEffect(() => {
    if (emptyMessage) {
      setReady(false)
      setLoadError(null)
      return
    }

    let mounted = true
    skipInitialFocus.current = true
    setReady(false)
    setLoadError(null)
    const el = mapElRef.current
    if (!el) return

    const markers = new Map<string, google.maps.Marker>()
    let polyline: google.maps.Polyline | null = null
    let map: google.maps.Map | null = null
    let mapsApi: typeof google.maps | null = null
    let resizeObserver: ResizeObserver | null = null
    const token = ++fitToken.current

    async function init() {
      let g: typeof google
      try {
        g = await loadGoogleMaps()
      } catch (error) {
        if (mounted) setLoadError(mapLoadMessage(error))
        return
      }
      const container = mapElRef.current
      if (!mounted || !container) return

      const maps = g.maps
      mapsApi = maps
      map = new maps.Map(container, {
        center: CORRIDOR_CENTER,
        zoom: 8,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        clickableIcons: false,
      })

      const drawn = pinsRef.current
      const corridor = coastalCorridorLine(coverageRef.current)
      const boundsPoints = corridor.map(toLatLng)
      if (corridor.length > 1) {
        polyline = new maps.Polyline({
          path: boundsPoints,
          strokeColor: "#111111",
          strokeWeight: 3,
          strokeOpacity: 0.45,
          clickable: false,
          map,
        })
      }
      for (const pin of drawn) {
        const at = toLatLng(coastalPinDisplayPoint(pin, drawn))
        boundsPoints.push(at)
        const marker = new maps.Marker({
          position: at,
          map,
          icon: markerIcon(maps, pin, false),
          zIndex: pin.role === "pickup" ? 200 : 100,
        })
        marker.addListener("click", () => onSelectRef.current(pin.jobId))
        markers.set(pin.key, marker)
      }

      markersRef.current = markers
      mapsRef.current = maps
      mapRef.current = map

      let fitted = false
      const fit = () => {
        if (!mounted || !map || fitted) return
        const rect = container.getBoundingClientRect()
        if (rect.width < 40 || rect.height < 40) return
        fitted = true
        if (boundsPoints.length === 1) {
          map.setCenter(boundsPoints[0])
          map.setZoom(FIT_MAX_ZOOM)
          return
        }
        if (boundsPoints.length < 2) return
        const bounds = new maps.LatLngBounds()
        for (const point of boundsPoints) bounds.extend(point)
        map.fitBounds(bounds, FIT_PADDING)
        const captured = token
        maps.event.addListenerOnce(map, "idle", () => {
          if (!mounted || !map || fitToken.current !== captured) return
          const zoom = map.getZoom()
          if (zoom != null && zoom > FIT_MAX_ZOOM) map.setZoom(FIT_MAX_ZOOM)
        })
      }

      let mapIdle = false
      maps.event.addListenerOnce(map, "idle", () => {
        if (!mounted) return
        mapIdle = true
        fit()
      })
      resizeObserver = new ResizeObserver(() => {
        if (mapIdle) fit()
      })
      resizeObserver.observe(container)
      if (mounted) setReady(true)
    }

    void init()
    return () => {
      mounted = false
      fitToken.current += 1
      resizeObserver?.disconnect()
      markers.forEach((marker) => {
        mapsApi?.event.clearInstanceListeners(marker)
        marker.setMap(null)
      })
      if (map && mapsApi) mapsApi.event.clearInstanceListeners(map)
      polyline?.setMap(null)
      markersRef.current = new Map()
      mapsRef.current = null
      mapRef.current = null
      if (mapElRef.current) mapElRef.current.replaceChildren()
    }
    // Redraw when the stops or job pins change, not when the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emptyMessage, pinSignature, coverageSignature])

  useEffect(() => {
    const map = mapRef.current
    const maps = mapsRef.current
    if (!map || !maps || !ready) return
    const drawn = pinsRef.current
    for (const pin of drawn) {
      const marker = markersRef.current.get(pin.key)
      if (!marker) continue
      const selected = pin.jobId === selectedJobId
      marker.setIcon(markerIcon(maps, pin, selected))
      marker.setZIndex(selected ? 500 : pin.role === "pickup" ? 200 : 100)
    }
    const focus = drawn.find((pin) => pin.focus)
    if (skipInitialFocus.current) {
      skipInitialFocus.current = false
      return
    }
    if (!focus) return
    const at = toLatLng(coastalPinDisplayPoint(focus, drawn))
    fitToken.current += 1
    map.panTo(at)
    map.setZoom(FOCUS_ZOOM)
  }, [ready, selectedJobId, pinSignature])

  return (
    <div className="relative h-full min-h-[280px] overflow-hidden bg-muted">
      <div ref={mapElRef} className="z-0 h-full min-h-[280px] w-full" />
      {emptyMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 px-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted px-6 text-center text-sm text-muted-foreground">
          {loadError}
        </div>
      ) : !ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  )
}
