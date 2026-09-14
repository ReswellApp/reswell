"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { ExternalLink, Save } from "lucide-react"
import { toast } from "sonner"

import {
  updateDropoffListingParcelAction,
  updateDropoffLocationAction,
} from "@/lib/actions/dropoffLocationActions"
import type {
  DropoffAdminListing,
  DropoffLocationsAdminDashboard,
} from "@/lib/services/dropoffLocations"
import type { DropoffLocationRow } from "@/lib/db/dropoff-locations"
import type { DropoffBoxRule } from "@/lib/dropoff-location-box-rules"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function DropoffLocationsAdminClient({
  initialData,
}: {
  initialData: DropoffLocationsAdminDashboard
}) {
  const [locations, setLocations] = useState(initialData.locations)
  const [listings, setListings] = useState(initialData.listings)
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id ?? "")

  const selectedLocation = locations.find((loc) => loc.id === selectedLocationId) ?? locations[0] ?? null
  const visibleListings = useMemo(
    () =>
      listings.filter((row) =>
        selectedLocationId ? row.locationId === selectedLocationId : true,
      ),
    [listings, selectedLocationId],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {locations.map((loc) => (
          <button
            key={loc.id}
            type="button"
            onClick={() => setSelectedLocationId(loc.id)}
            className={
              loc.id === selectedLocationId
                ? "rounded-full bg-foreground px-3 py-1 text-sm text-background"
                : "rounded-full border border-border px-3 py-1 text-sm text-foreground"
            }
          >
            {loc.name}
            {!loc.active ? " (inactive)" : ""}
          </button>
        ))}
      </div>

      {selectedLocation ? (
        <LocationRulesForm
          key={selectedLocation.id}
          location={selectedLocation}
          onSaved={(next) => {
            setLocations((prev) => prev.map((loc) => (loc.id === next.id ? next : loc)))
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No dropoff locations yet.</p>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Listings using this dropoff</h2>
          <p className="text-sm text-muted-foreground">
            Review board dimensions and change the packed box if the assigned size is wrong.
          </p>
        </div>
        {visibleListings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            No listings have chosen this dropoff yet.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleListings.map((listing) => (
              <ListingParcelCard
                key={listing.id}
                listing={listing}
                onSaved={(next) => {
                  setListings((prev) => prev.map((row) => (row.id === next.id ? next : row)))
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function LocationRulesForm({
  location,
  onSaved,
}: {
  location: DropoffLocationRow
  onSaved: (location: DropoffLocationRow) => void
}) {
  const [name, setName] = useState(location.name)
  const [addressLine1, setAddressLine1] = useState(location.address_line1)
  const [city, setCity] = useState(location.city)
  const [state, setState] = useState(location.state)
  const [postalCode, setPostalCode] = useState(location.postal_code)
  const [hoursNote, setHoursNote] = useState(location.hours_note ?? "")
  const [active, setActive] = useState(location.active)
  const [rules, setRules] = useState<DropoffBoxRule[]>(location.box_rules)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const result = await updateDropoffLocationAction({
      id: location.id,
      name,
      address_line1: addressLine1,
      address_line2: location.address_line2,
      city,
      state,
      postal_code: postalCode,
      phone: location.phone,
      hours_note: hoursNote,
      latitude: location.latitude,
      longitude: location.longitude,
      active,
      box_rules: rules,
    })
    setSaving(false)
    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }
    if ("location" in result && result.location) {
      onSaved(result.location)
      toast.success("Dropoff location saved")
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Location and box sizes</h2>
          <p className="text-sm text-muted-foreground">
            First matching rule wins. Lengths are board inches (6&apos;0 = 72, 6&apos;6 = 78).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="dropoff-active" className="text-sm">
            Active
          </Label>
          <Switch id="dropoff-active" checked={active} onCheckedChange={setActive} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Street" value={addressLine1} onChange={setAddressLine1} />
        <Field label="City" value={city} onChange={setCity} />
        <Field label="State" value={state} onChange={setState} />
        <Field label="ZIP" value={postalCode} onChange={setPostalCode} />
        <Field label="Hours / note" value={hoursNote} onChange={setHoursNote} />
      </div>

      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div key={rule.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Rule label"
              value={rule.label}
              onChange={(label) =>
                setRules((prev) => prev.map((row, i) => (i === index ? { ...row, label } : row)))
              }
            />
            <NumberField
              label="Min length (in)"
              value={rule.minLengthIn}
              nullable
              onChange={(minLengthIn) =>
                setRules((prev) => prev.map((row, i) => (i === index ? { ...row, minLengthIn } : row)))
              }
            />
            <NumberField
              label="Max length (in)"
              value={rule.maxLengthIn}
              onChange={(maxLengthIn) =>
                setRules((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, maxLengthIn: maxLengthIn ?? row.maxLengthIn } : row)),
                )
              }
            />
            <NumberField
              label="Max width (in)"
              value={rule.maxWidthIn}
              nullable
              onChange={(maxWidthIn) =>
                setRules((prev) => prev.map((row, i) => (i === index ? { ...row, maxWidthIn } : row)))
              }
            />
            <NumberField
              label="Box L"
              value={rule.boxLengthIn}
              onChange={(boxLengthIn) =>
                setRules((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, boxLengthIn: boxLengthIn ?? row.boxLengthIn } : row)),
                )
              }
            />
            <NumberField
              label="Box W"
              value={rule.boxWidthIn}
              onChange={(boxWidthIn) =>
                setRules((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, boxWidthIn: boxWidthIn ?? row.boxWidthIn } : row)),
                )
              }
            />
            <NumberField
              label="Box H"
              value={rule.boxHeightIn}
              onChange={(boxHeightIn) =>
                setRules((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, boxHeightIn: boxHeightIn ?? row.boxHeightIn } : row)),
                )
              }
            />
            <NumberField
              label="Weight (lb)"
              value={rule.weightLb}
              onChange={(weightLb) =>
                setRules((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, weightLb: weightLb ?? row.weightLb } : row)),
                )
              }
            />
          </div>
        ))}
      </div>

      <Button type="button" onClick={() => void save()} disabled={saving}>
        <Save className="mr-2 h-4 w-4" aria-hidden />
        {saving ? "Saving…" : "Save location"}
      </Button>
    </section>
  )
}

function ListingParcelCard({
  listing,
  onSaved,
}: {
  listing: DropoffAdminListing
  onSaved: (listing: DropoffAdminListing) => void
}) {
  const [lengthIn, setLengthIn] = useState(listing.packedLengthIn)
  const [widthIn, setWidthIn] = useState(listing.packedWidthIn)
  const [heightIn, setHeightIn] = useState(listing.packedHeightIn)
  const [weightLb, setWeightLb] = useState(listing.packedWeightLb)
  const [saving, setSaving] = useState(false)

  async function save() {
    const L = Number.parseFloat(lengthIn)
    const W = Number.parseFloat(widthIn)
    const H = Number.parseFloat(heightIn)
    const wt = Number.parseFloat(weightLb)
    if (![L, W, H, wt].every((n) => Number.isFinite(n) && n > 0)) {
      toast.error("Enter box length, width, height, and weight.")
      return
    }
    setSaving(true)
    const result = await updateDropoffListingParcelAction({
      listingId: listing.id,
      lengthIn: L,
      widthIn: W,
      heightIn: H,
      weightLb: wt,
    })
    setSaving(false)
    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }
    onSaved({
      ...listing,
      packedLengthIn: String(L),
      packedWidthIn: String(W),
      packedHeightIn: String(H),
      packedWeightLb: String(wt),
      packedWeightOz: "0",
      currentBox: `${L}×${W}×${H}`,
    })
    toast.success("Box size updated")
  }

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {listing.thumbnailUrl ? (
          <Image src={listing.thumbnailUrl} alt="" fill className="object-cover" sizes="96px" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">{listing.title}</p>
            <p className="text-sm text-muted-foreground">
              {listing.boardDimensions}
              {listing.sellerCity ? ` · ${listing.sellerCity}` : ""}
              {` · ${listing.status}`}
            </p>
            {listing.suggestedBox ? (
              <p className="text-xs text-muted-foreground">Rule suggests {listing.suggestedBox}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={listing.href} target="_blank" rel="noreferrer">
                View listing
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={listing.editHref}>Edit listing</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Field label="Box L" value={lengthIn} onChange={setLengthIn} />
          <Field label="Box W" value={widthIn} onChange={setWidthIn} />
          <Field label="Box H" value={heightIn} onChange={setHeightIn} />
          <Field label="Weight lb" value={weightLb} onChange={setWeightLb} />
          <div className="flex items-end">
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving} className="w-full">
              {saving ? "Saving…" : "Update box"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  nullable = false,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  nullable?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        inputMode="decimal"
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value.trim()
          if (!raw) {
            onChange(nullable ? null : 0)
            return
          }
          const n = Number.parseFloat(raw)
          onChange(Number.isFinite(n) ? n : nullable ? null : 0)
        }}
      />
    </div>
  )
}
