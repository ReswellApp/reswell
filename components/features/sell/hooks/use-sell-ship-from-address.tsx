"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { getSellerShipFromSetup } from "@/lib/actions/sellerShipFromActions"
import { createClient } from "@/lib/supabase/client"
import {
  listingLocalityHasPin,
  type ListingLocalityFromAddress,
} from "@/lib/sell-flow/listing-locality-from-address"
import { SellShipFromAddressDialog } from "@/components/features/sell/sell-ship-from-address-dialog"

export type UseSellShipFromAddressOptions = {
  /** True when the listing offers shipping (any paid/free/flat mode). */
  shippingSelected: boolean
  /** Form hydrated, not impersonating. */
  ready: boolean
  /** Guided shipping step, advanced mode, or a publish attempt — not Quick list. */
  promptWhen: boolean
  allowDismissToPickup: boolean
  onDismissToPickup?: () => void
  /** `load` = existing saved address; `save` = just captured in the popup. */
  onLocalityReady?: (loc: ListingLocalityFromAddress, source: "load" | "save") => void
}

export type UseSellShipFromAddressResult = {
  setupReady: boolean
  hasShipFrom: boolean
  listingLocality: ListingLocalityFromAddress | null
  dialog: ReactNode
  ensureShipFrom: () => Promise<boolean>
}

async function fillLocalityPin(
  loc: ListingLocalityFromAddress,
): Promise<ListingLocalityFromAddress> {
  if (listingLocalityHasPin(loc)) return loc
  const q = [loc.city, loc.state].filter(Boolean).join(", ")
  if (q.length < 2) return loc
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
    if (!res.ok) return loc
    const data = (await res.json()) as { lat?: number; lng?: number }
    if (data.lat == null || data.lng == null) return loc
    if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return loc
    return { ...loc, lat: data.lat, lng: data.lng }
  } catch {
    return loc
  }
}

export function useSellShipFromAddress(
  opts: UseSellShipFromAddressOptions,
): UseSellShipFromAddressResult {
  const {
    shippingSelected,
    ready,
    promptWhen,
    allowDismissToPickup,
    onDismissToPickup,
    onLocalityReady,
  } = opts

  const onLocalityReadyRef = useRef(onLocalityReady)
  onLocalityReadyRef.current = onLocalityReady
  const loadNotifiedRef = useRef(false)

  const [setupReady, setSetupReady] = useState(false)
  const [hasShipFrom, setHasShipFrom] = useState(false)
  const [needsFullName, setNeedsFullName] = useState(false)
  const [needsPhone, setNeedsPhone] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [listingLocality, setListingLocality] = useState<ListingLocalityFromAddress | null>(
    null,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const loadGenRef = useRef(0)

  const loadSetup = useCallback(async () => {
    const gen = ++loadGenRef.current
    const setup = await getSellerShipFromSetup()
    if (gen !== loadGenRef.current) return setup
    setSignedIn(setup.signedIn)
    setHasShipFrom(setup.hasShipFrom)
    setNeedsFullName(setup.needsFullName)
    setNeedsPhone(setup.needsPhone)
    if (setup.locality) {
      const withPin = await fillLocalityPin(setup.locality)
      if (gen !== loadGenRef.current) return setup
      setListingLocality(withPin)
      if (!loadNotifiedRef.current) {
        loadNotifiedRef.current = true
        onLocalityReadyRef.current?.(withPin, "load")
      }
    } else {
      setListingLocality(null)
    }
    setSetupReady(true)
    return setup
  }, [])

  useEffect(() => {
    if (!ready) return
    void loadSetup()
  }, [ready, loadSetup])

  useEffect(() => {
    if (!ready) return
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void loadSetup()
      }
    })
    return () => subscription.unsubscribe()
  }, [ready, loadSetup])

  useEffect(() => {
    if (!ready || !setupReady || !signedIn) return
    if (!shippingSelected || hasShipFrom || !promptWhen) {
      if (!shippingSelected) setDialogOpen(false)
      return
    }
    setDialogOpen(true)
  }, [ready, setupReady, signedIn, shippingSelected, hasShipFrom, promptWhen])

  const handleSaved = useCallback(async (locality: ListingLocalityFromAddress) => {
    const withPin = await fillLocalityPin(locality)
    setListingLocality(withPin)
    setHasShipFrom(true)
    setDialogOpen(false)
    loadNotifiedRef.current = true
    onLocalityReadyRef.current?.(withPin, "save")
  }, [])

  const handleDismissToPickup = useCallback(() => {
    setDialogOpen(false)
    onDismissToPickup?.()
  }, [onDismissToPickup])

  const ensureShipFrom = useCallback(async () => {
    if (hasShipFrom) return true
    const setup = await loadSetup()
    if (setup.hasShipFrom) return true
    if (setup.signedIn) setDialogOpen(true)
    return false
  }, [hasShipFrom, loadSetup])

  const dialog = (
    <SellShipFromAddressDialog
      open={dialogOpen}
      needsFullName={needsFullName}
      needsPhone={needsPhone}
      allowDismissToPickup={allowDismissToPickup}
      onSaved={(loc) => {
        void handleSaved(loc)
      }}
      onDismissToPickup={allowDismissToPickup ? handleDismissToPickup : undefined}
    />
  )

  return {
    setupReady,
    hasShipFrom,
    listingLocality,
    dialog,
    ensureShipFrom,
  }
}
