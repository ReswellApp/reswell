"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { CoastalMatchPanel, CoastalStopSelect } from "@/components/features/admin/coastal-delivery/coastal-match-panel"
import {
  matchCoastalPreviewAction,
  saveCoastalDeliveryChoiceAction,
} from "@/lib/actions/coastalDeliveryActions"
import type {
  CoastalDeliveryChoiceView,
  CoastalListingPreview,
  CoastalMatchResult,
  CoastalStopView,
} from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface CoastalListingChoiceProps {
  listing: CoastalListingPreview
  stops: CoastalStopView[]
  choice: CoastalDeliveryChoiceView | null
  initialMatch: CoastalMatchResult | null
}

export function CoastalListingChoice({ listing, stops, choice, initialMatch }: CoastalListingChoiceProps) {
  const router = useRouter()
  const [whiteGlove, setWhiteGlove] = useState(choice !== null)
  const [pickupStopId, setPickupStopId] = useState(choice?.pickupStopId ?? listing.suggestedPickupStopId ?? "")
  const [dropoffStopId, setDropoffStopId] = useState(choice?.dropoffStopId ?? "")
  const [sellerOriginLabel, setSellerOriginLabel] = useState(
    choice?.sellerOriginLabel ||
      (listing.city && !listing.suggestedPickupStopId ? `Listing city: ${listing.city}` : ""),
  )
  const [shipperId, setShipperId] = useState(choice?.shipperId ?? "")
  const [match, setMatch] = useState<CoastalMatchResult | null>(initialMatch)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(choice ? "Saved. Waiting for a run." : null)
  const [pending, startTransition] = useTransition()

  function onMatch() {
    setNotice(null)
    startTransition(async () => {
      const result = await matchCoastalPreviewAction({ pickupStopId, dropoffStopId })
      if (!("match" in result) || !result.match) {
        setError("error" in result && result.error ? result.error : "Could not match shippers.")
        setMatch(null)
        return
      }
      setError(null)
      setMatch(result.match)
      if (result.match.matches.every((item) => item.shipperId !== shipperId)) setShipperId("")
    })
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveCoastalDeliveryChoiceAction({
        listingId: listing.id,
        whiteGlove,
        pickupStopId: pickupStopId || undefined,
        dropoffStopId: dropoffStopId || undefined,
        sellerOriginLabel,
        shipperId: shipperId || null,
      })
      if (!("saved" in result)) {
        setError("error" in result && result.error ? result.error : "Could not save Shipper.")
        return
      }
      setError(null)
      setNotice(result.saved ? "Saved. Waiting for a run." : "Shipper removed from this listing.")
      if (!result.saved) setWhiteGlove(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Shipper</h2>
          <p className="text-sm text-muted-foreground">Hand delivery along the corridor. No charge in this draft.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={whiteGlove} onCheckedChange={setWhiteGlove} aria-label="Turn Shipper on for this listing" />
          {whiteGlove ? "On" : "Off"}
        </label>
      </div>
      {!whiteGlove ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Shipper is off for this listing.
        </p>
      ) : (
        <div className="space-y-4">
          <CoastalStopSelect
            id="pickup"
            label="Pickup stop"
            value={pickupStopId}
            stops={stops}
            onChange={(value) => {
              setPickupStopId(value)
              setMatch(null)
              setShipperId("")
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="sellerOrigin">Seller origin note</Label>
            <Input
              id="sellerOrigin"
              value={sellerOriginLabel}
              onChange={(event) => setSellerOriginLabel(event.target.value)}
              placeholder="Optional. Where the seller hands the board off."
            />
          </div>
          <CoastalStopSelect
            id="dropoff"
            label="Drop-off"
            value={dropoffStopId}
            stops={stops}
            onChange={(value) => {
              setDropoffStopId(value)
              setMatch(null)
              setShipperId("")
            }}
          />
          <Button type="button" variant="secondary" disabled={pending} onClick={onMatch}>
            See matching shippers
          </Button>
          <CoastalMatchPanel match={match} shipperId={shipperId} onShipper={setShipperId} />
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-foreground">{notice}</p> : null}
      <Button type="button" disabled={pending} onClick={onSave}>
        {pending ? "Saving…" : "Save choice"}
      </Button>
    </div>
  )
}
