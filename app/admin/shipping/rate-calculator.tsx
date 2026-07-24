'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ArrowLeftRight, ChevronDown, ChevronUp, Loader2, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AddressFields } from './address-fields'
import {
  buildShipmentBody,
  extractRatesFromApiEnvelope,
  rateMoneyTotal,
} from '@/lib/shipping/shipengine-rate-helpers'
import {
  SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN,
  surfboardShippingDimIn,
} from '@/lib/shipping/surfboard-label-limits'
import { totalBoardLengthInchesFromCombinedInput } from '@/lib/board-measurements'
import {
  SURFBOARD_SHIPPING_TIERS,
  surfboardShippingTierPackedParcelFromBoardLengthIn,
} from '@/lib/surfboard-shipping-tiers'
import { AddressForm } from './shipping-address-form'
import { RATE_SEED_LISTINGS } from './rate-seed-listings'
import { ReswellUpsCarrierStatus } from './reswell-ups-carrier-status'
import { RateLaneMatrix } from './rate-lane-matrix'
import { ShortboardRateCliffSweep } from './shortboard-rate-cliff-sweep'
import {
  EXAMPLE_BOARD_PRESETS,
  SIZE_LADDER_PRESETS,
  TIER_CEILING_PRESETS,
  type RatePackagePreset,
} from './rate-package-presets'
import {
  isReswellUpsCarrier,
  isReswellUpsCarrierId,
  RESWELL_UPS_CARRIER_ID,
} from '@/lib/shipengine/reswell-carriers'

const inputClass = 'h-11 rounded-xl'
const selectTriggerClass = 'h-11 rounded-xl'
const surfaceCard = 'rounded-2xl border border-border bg-card'
const shipTableShell = 'overflow-hidden rounded-xl border border-border bg-card'
const shipTh = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-11'

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

const defaultFrom: AddressFields = {
  name: 'Ship from',
  phone: '555-0100',
  company_name: '',
  address_line1: '4301 Bull Creek Road',
  address_line2: '',
  city_locality: 'Austin',
  state_province: 'TX',
  postal_code: '78731',
  country_code: 'US',
  residential: 'no',
}

const defaultTo: AddressFields = {
  name: 'Recipient',
  phone: '555-0200',
  company_name: '',
  address_line1: '1600 Pennsylvania Avenue NW',
  address_line2: '',
  city_locality: 'Washington',
  state_province: 'DC',
  postal_code: '20500',
  country_code: 'US',
  residential: 'no',
}

type CompareRow = {
  id: string
  label: string
  weightOz: string
  lengthIn: string
  widthIn: string
  heightIn: string
}

function newCompareRow(partial?: Partial<CompareRow>): CompareRow {
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `r-${Math.random().toString(36).slice(2)}`,
    label: partial?.label ?? 'Package',
    weightOz: partial?.weightOz ?? '48',
    lengthIn: partial?.lengthIn ?? '72',
    widthIn: partial?.widthIn ?? '20',
    heightIn: partial?.heightIn ?? '6',
  }
}

function compareRowFromPreset(preset: RatePackagePreset): CompareRow {
  return newCompareRow({
    label: preset.label,
    weightOz: String(Math.round(preset.weightLb * 16)),
    lengthIn: String(preset.lengthIn),
    widthIn: String(preset.widthIn),
    heightIn: String(preset.heightIn),
  })
}

function downloadRatesCsv(
  rates: Record<string, unknown>[],
  meta: { from: string; to: string; packageLine: string },
): void {
  const header = [
    'Total',
    'Currency',
    'Carrier',
    'carrier_id',
    'Service',
    'service_code',
    'Days',
    'Est delivery',
    'rate_id',
    'Ship from',
    'Ship to',
    'Package',
  ]
  const rows = rates.map((r) => {
    const { total, currency } = rateMoneyTotal(r)
    return [
      total.toFixed(2),
      currency,
      String(r.carrier_friendly_name ?? r.carrier_code ?? ''),
      String(r.carrier_id ?? ''),
      String(r.service_type ?? ''),
      String(r.service_code ?? ''),
      r.delivery_days != null ? String(r.delivery_days) : '',
      r.estimated_delivery_date ? String(r.estimated_delivery_date).slice(0, 16) : '',
      String(r.rate_id ?? ''),
      meta.from,
      meta.to,
      meta.packageLine,
    ]
  })
  const csvCell = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `reswell-rates-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

type SortKey = 'price' | 'delivery' | 'service'

type ListingRateDiagnosticResult = {
  ok: true
  listing: { id: string; slug: string | null; title: string | null }
  savedPackedFields: {
    shipping_packed_length_in: number | string | null
    shipping_packed_width_in: number | string | null
    shipping_packed_height_in: number | string | null
    shipping_packed_weight_oz: number | string | null
  }
  parcelSource: 'board+saved-weight' | 'board+heuristic-weight' | 'heuristic'
  cheapest: {
    totalAmount: number
    currency: string
    carrierName: string
    serviceName: string
    deliveryDays: number | null
    attributes: string[]
  }
  topRates: ListingRateDiagnosticResult['cheapest'][]
  payload: unknown
}

function formatSavedField(v: number | string | null): string {
  if (v == null || v === '') return '— (not saved)'
  return String(v)
}

type ListingRateExtracted = {
  weightValue: number
  weightUnit: 'ounce' | 'pound' | 'gram' | 'kilogram'
  length: number
  width: number
  height: number
  dimUnit: 'inch' | 'centimeter'
  packageCode: string
  shipFrom: AddressFields | null
  shipTo: AddressFields | null
}

function extractListingRatePayload(payload: unknown): ListingRateExtracted | null {
  const root = asRecord(payload)
  const shipment = asRecord(root?.shipment)
  if (!shipment) return null
  const packages = Array.isArray(shipment.packages)
    ? (shipment.packages as unknown[])
    : []
  const pkg = asRecord(packages[0])
  if (!pkg) return null
  const weight = asRecord(pkg.weight)
  const dims = asRecord(pkg.dimensions)
  if (!weight || !dims) return null
  const wv = Number(weight.value)
  const wu = String(weight.unit ?? 'ounce') as ListingRateExtracted['weightUnit']
  const length = Number(dims.length)
  const width = Number(dims.width)
  const height = Number(dims.height)
  const dimUnit = String(dims.unit ?? 'inch') as ListingRateExtracted['dimUnit']
  const packageCode =
    typeof pkg.package_code === 'string' && pkg.package_code.trim()
      ? pkg.package_code
      : 'package'
  if (![wv, length, width, height].every((n) => Number.isFinite(n) && n > 0)) {
    return null
  }
  return {
    weightValue: wv,
    weightUnit: wu,
    length,
    width,
    height,
    dimUnit,
    packageCode,
    shipFrom: shipEnginePayloadAddressToFields(shipment.ship_from),
    shipTo: shipEnginePayloadAddressToFields(shipment.ship_to),
  }
}

function shipEnginePayloadAddressToFields(raw: unknown): AddressFields | null {
  const r = asRecord(raw)
  if (!r) return null
  return {
    name: String(r.name ?? ''),
    phone: String(r.phone ?? ''),
    company_name: String(r.company_name ?? ''),
    address_line1: String(r.address_line1 ?? ''),
    address_line2: String(r.address_line2 ?? ''),
    city_locality: String(r.city_locality ?? ''),
    state_province: String(r.state_province ?? ''),
    postal_code: String(r.postal_code ?? ''),
    country_code: String(r.country_code ?? 'US'),
    residential:
      r.address_residential_indicator === 'yes'
        ? 'yes'
        : r.address_residential_indicator === 'no'
          ? 'no'
          : 'unknown',
  }
}

function ListingRateDiagnostic({
  onApplyToCalculator,
}: {
  onApplyToCalculator?: (extracted: ListingRateExtracted) => void
}) {
  const [listingRef, setListingRef] = useState('')
  const [buyerLine1, setBuyerLine1] = useState('816 Alberta Avenue')
  const [buyerCity, setBuyerCity] = useState('Santa Barbara')
  const [buyerState, setBuyerState] = useState('CA')
  const [buyerZip, setBuyerZip] = useState('93101')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ListingRateDiagnosticResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!listingRef.trim()) {
      toast.error('Paste a listing slug, UUID, or URL')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/shipping/quote-listing', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_ref: listingRef.trim(),
          buyer: {
            address_line1: buyerLine1,
            city_locality: buyerCity,
            state_province: buyerState,
            postal_code: buyerZip,
            country_code: 'US',
            residential: 'no',
          },
        }),
      })
      const data = (await res.json()) as
        | ListingRateDiagnosticResult
        | { ok: false; error: string }
      if (!res.ok || data.ok !== true) {
        setError('error' in data ? data.error : 'Could not rate listing')
        return
      }
      setResult(data as ListingRateDiagnosticResult)
      toast.success('Rated via shared checkout path')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="listing-ref" className="text-[12px] font-medium">
            Listing
          </Label>
          <Input
            id="listing-ref"
            value={listingRef}
            onChange={(e) => setListingRef(e.target.value)}
            placeholder="Slug (e.g. 510-hayden-shapes-hypto-krypto), UUID, or full /l/<slug> URL"
            className="mt-1 h-10 text-[13px]"
          />
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Paste the slug from the public listing URL (everything after{' '}
            <code className="rounded bg-muted/70 px-1 font-mono text-[10.5px]">/l/</code>), the
            full URL, or the row id from{' '}
            <code className="rounded bg-muted/70 px-1 font-mono text-[10.5px]">listings.id</code>.
          </p>
        </div>
        <div>
          <Label htmlFor="buyer-zip" className="text-[12px] font-medium">
            Buyer ZIP
          </Label>
          <Input
            id="buyer-zip"
            value={buyerZip}
            onChange={(e) => setBuyerZip(e.target.value)}
            className="mt-1 h-10 text-[13px]"
          />
        </div>
        <div>
          <Label htmlFor="buyer-city" className="text-[12px] font-medium">
            Buyer city
          </Label>
          <Input
            id="buyer-city"
            value={buyerCity}
            onChange={(e) => setBuyerCity(e.target.value)}
            className="mt-1 h-10 text-[13px]"
          />
        </div>
        <div>
          <Label htmlFor="buyer-state" className="text-[12px] font-medium">
            Buyer state
          </Label>
          <Input
            id="buyer-state"
            value={buyerState}
            onChange={(e) => setBuyerState(e.target.value)}
            className="mt-1 h-10 text-[13px]"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="buyer-line1" className="text-[12px] font-medium">
            Buyer street
          </Label>
          <Input
            id="buyer-line1"
            value={buyerLine1}
            onChange={(e) => setBuyerLine1(e.target.value)}
            className="mt-1 h-10 text-[13px]"
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-10 px-5 text-[13px] font-medium"
        onClick={() => void submit()}
        disabled={busy}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Rate listing
      </Button>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        (() => {
          const extracted = extractListingRatePayload(result.payload)
          return (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/40 bg-muted/15 p-4 text-[14px]">
                {result.listing.title || result.listing.slug ? (
                  <div className="mb-1 text-[12px] text-muted-foreground">
                    Resolved:{' '}
                    <span className="font-medium text-foreground/85">
                      {result.listing.title ?? result.listing.slug}
                    </span>{' '}
                    <span className="font-mono text-[11px]">
                      ({result.listing.id.slice(0, 8)}…)
                    </span>
                  </div>
                ) : null}
                <div className="font-semibold tracking-tight">
                  Cheapest:{' '}
                  <span className="font-mono">
                    {result.cheapest.currency} {result.cheapest.totalAmount.toFixed(2)}
                  </span>{' '}
                  · {result.cheapest.carrierName} {result.cheapest.serviceName}
                  {result.cheapest.deliveryDays != null
                    ? ` · ${result.cheapest.deliveryDays}d`
                    : ''}
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  This is the exact same total `/checkout` will charge the buyer for Reswell shipping.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-300/50 bg-emerald-50/50 p-4 text-[13px] dark:border-emerald-400/30 dark:bg-emerald-500/[0.08]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                  {result.parcelSource === 'board+saved-weight'
                    ? 'Board L×W×Thickness + seller-saved weight'
                    : result.parcelSource === 'board+heuristic-weight'
                      ? 'Board L×W×Thickness + heuristic weight'
                      : 'Legacy stored packed values'}
                </div>
                <p className="mt-1 leading-relaxed">
                  {result.parcelSource === 'heuristic'
                    ? 'Listing is missing board dimensions; falling back to stored packed columns.'
                    : "L×W×H come from the listing's board fields, floored to whole inches. Weight comes from " +
                      (result.parcelSource === 'board+saved-weight'
                        ? "the seller's saved Reswell weight."
                        : 'a length/volume heuristic because no weight was saved.')}
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Stored columns (for reference):{' '}
                  <code className="font-mono text-[11px]">
                    L={formatSavedField(result.savedPackedFields.shipping_packed_length_in)}
                  </code>{' '}
                  <code className="font-mono text-[11px]">
                    W={formatSavedField(result.savedPackedFields.shipping_packed_width_in)}
                  </code>{' '}
                  <code className="font-mono text-[11px]">
                    H={formatSavedField(result.savedPackedFields.shipping_packed_height_in)}
                  </code>{' '}
                  <code className="font-mono text-[11px]">
                    oz={formatSavedField(result.savedPackedFields.shipping_packed_weight_oz)}
                  </code>{' '}
                  — these are no longer the source of truth; padding from a legacy commit may make
                  them inflated.
                </p>
              </div>

              {extracted ? (
                <div className="rounded-2xl border border-amber-300/50 bg-amber-50/50 p-4 text-[13px] dark:border-amber-400/30 dark:bg-amber-500/[0.08]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                    Parcel + lane sent to ShipEngine
                  </div>
                  <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Weight</dt>
                      <dd className="font-mono">
                        {extracted.weightValue} {extracted.weightUnit}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Dimensions</dt>
                      <dd className="font-mono">
                        {extracted.length} × {extracted.width} × {extracted.height}{' '}
                        {extracted.dimUnit}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Ship from</dt>
                      <dd className="font-mono text-right">
                        {extracted.shipFrom?.city_locality}, {extracted.shipFrom?.state_province}{' '}
                        {extracted.shipFrom?.postal_code}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Ship to</dt>
                      <dd className="font-mono text-right">
                        {extracted.shipTo?.city_locality}, {extracted.shipTo?.state_province}{' '}
                        {extracted.shipTo?.postal_code}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Package code</dt>
                      <dd className="font-mono">{extracted.packageCode}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Residential</dt>
                      <dd className="font-mono">{extracted.shipTo?.residential ?? 'unknown'}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    If these don't match the dims you typed into the calculator above, you've found
                    the divergence — fix the listing's saved packed dimensions or origin.
                  </p>
                  {onApplyToCalculator ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 h-9 rounded-xl border-amber-400/50 bg-background px-4 text-[13px] font-medium"
                      onClick={() => onApplyToCalculator(extracted)}
                    >
                      Load these dims into the calculator above
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <details className="rounded-2xl border border-border/50 bg-muted/10">
                <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                  Top 5 rate options
                </summary>
                <ul className="space-y-1 px-4 pb-3 text-[13px]">
                  {result.topRates.map((r, idx) => (
                    <li
                      key={`${r.carrierName}-${r.serviceName}-${idx}`}
                      className="font-mono"
                    >
                      {r.currency} {r.totalAmount.toFixed(2)} — {r.carrierName} · {r.serviceName}
                      {r.deliveryDays != null ? ` · ${r.deliveryDays}d` : ''}
                    </li>
                  ))}
                </ul>
              </details>

              <details
                open
                className="rounded-2xl border border-border/50 bg-muted/10"
              >
                <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                  ShipEngine /rates payload (what checkout sent)
                </summary>
                <pre className="mx-3 mb-3 max-h-72 overflow-x-auto rounded-xl border border-border/40 bg-black/[0.03] p-4 font-mono text-[11px] leading-relaxed dark:bg-white/[0.04]">
                  {JSON.stringify(result.payload, null, 2)}
                </pre>
              </details>
            </div>
          )
        })()
      ) : null}
    </div>
  )
}

export function ShippingRateCalculator({
  carriers,
}: {
  carriers: Record<string, unknown>[]
}) {
  const carrierIds = useMemo(
    () =>
      carriers
        .map((c) => (typeof c.carrier_id === 'string' ? c.carrier_id : null))
        .filter(Boolean) as string[],
    [carriers],
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const carriersSeenRef = useRef(false)
  useEffect(() => {
    if (carrierIds.length === 0) return
    if (!carriersSeenRef.current) {
      carriersSeenRef.current = true
      setSelectedIds(
        carrierIds.includes(RESWELL_UPS_CARRIER_ID)
          ? [RESWELL_UPS_CARRIER_ID]
          : [...carrierIds],
      )
    }
  }, [carrierIds])

  const [shipFrom, setShipFrom] = useState<AddressFields>(defaultFrom)
  const [shipTo, setShipTo] = useState<AddressFields>(defaultTo)

  const shortCeiling = TIER_CEILING_PRESETS[0]
  const [weight, setWeight] = useState(String(shortCeiling?.weightLb ?? 22))
  const [weightUnit, setWeightUnit] = useState<'ounce' | 'pound' | 'gram' | 'kilogram'>('pound')
  const [length, setLength] = useState(String(shortCeiling?.lengthIn ?? 78))
  const [width, setWidth] = useState(String(shortCeiling?.widthIn ?? 27))
  const [height, setHeight] = useState(String(shortCeiling?.heightIn ?? 7))
  const [dimUnit, setDimUnit] = useState<'inch' | 'centimeter'>('inch')
  const [packageCode, setPackageCode] = useState('package')
  const [validateAddress, setValidateAddress] = useState<
    'no_validation' | 'validate_only' | 'validate_and_clean'
  >('no_validation')
  const [boardLengthInput, setBoardLengthInput] = useState('6\'2')
  const [activePresetId, setActivePresetId] = useState<string | null>(
    shortCeiling?.id ?? null,
  )

  const [singleBusy, setSingleBusy] = useState(false)
  const [singleResult, setSingleResult] = useState<unknown>(null)

  const [sortKey, setSortKey] = useState<SortKey>('price')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [compareRows, setCompareRows] = useState<CompareRow[]>(() =>
    TIER_CEILING_PRESETS.map(compareRowFromPreset),
  )

  const packageDimIn = useMemo(() => {
    const l = Number(length)
    const w = Number(width)
    const h = Number(height)
    if (![l, w, h].every((n) => Number.isFinite(n) && n > 0) || dimUnit !== 'inch') {
      return null
    }
    return surfboardShippingDimIn(l, w, h)
  }, [length, width, height, dimUnit])

  const applyPackagePreset = useCallback((preset: RatePackagePreset) => {
    setWeight(String(preset.weightLb))
    setWeightUnit('pound')
    setLength(String(preset.lengthIn))
    setWidth(String(preset.widthIn))
    setHeight(String(preset.heightIn))
    setDimUnit('inch')
    setActivePresetId(preset.id)
    toast.message(`Loaded ${preset.label}`, { description: preset.description })
  }, [])

  const applyBoardLengthToPackage = useCallback(() => {
    const totalIn = totalBoardLengthInchesFromCombinedInput(boardLengthInput)
    if (totalIn == null) {
      toast.error('Enter board length like 6\'2, 5.10, or 9\'6')
      return
    }
    const packed = surfboardShippingTierPackedParcelFromBoardLengthIn(totalIn)
    const tier = SURFBOARD_SHIPPING_TIERS[packed.tierId]
    setWeight(String(packed.weightLb))
    setWeightUnit('pound')
    setLength(String(packed.lengthIn))
    setWidth(String(packed.widthIn))
    setHeight(String(packed.heightIn))
    setDimUnit('inch')
    setActivePresetId(null)
    toast.success(
      `${tier.label} pack from ${totalIn}" board → ${packed.lengthIn}×${packed.widthIn}×${packed.heightIn} in · ${packed.weightLb} lb`,
    )
  }, [boardLengthInput])

  const swapAddresses = useCallback(() => {
    setShipFrom(shipTo)
    setShipTo(shipFrom)
    toast.message('Swapped ship-from and ship-to')
  }, [shipFrom, shipTo])
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareResults, setCompareResults] = useState<
    { row: CompareRow; envelope: unknown; error?: string }[] | null
  >(null)

  const [jsonOpen, setJsonOpen] = useState(false)
  const [manualJson, setManualJson] = useState('')
  const [manualBusy, setManualBusy] = useState(false)

  const toggleCarrier = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const selectAllCarriers = useCallback(() => {
    setSelectedIds([...carrierIds])
  }, [carrierIds])

  const clearCarriers = useCallback(() => setSelectedIds([]), [])

  const selectReswellUpsOnly = useCallback(() => {
    if (!carrierIds.includes(RESWELL_UPS_CARRIER_ID)) {
      toast.error(`Reswell UPS carrier ${RESWELL_UPS_CARRIER_ID} is not connected`)
      return
    }
    setSelectedIds([RESWELL_UPS_CARRIER_ID])
  }, [carrierIds])

  const runRates = useCallback(
    async (payload: object) => {
      const res = await fetch('/api/admin/shipengine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rates', payload }),
      })
      const data = (await res.json()) as unknown
      const ok = asRecord(data)?.ok === true
      if (!res.ok || !ok) {
        const err = asRecord(data)?.error ?? data
        throw new Error(typeof err === 'string' ? err : JSON.stringify(err))
      }
      return data
    },
    [],
  )

  const handleSingleCalculate = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one carrier')
      return
    }
    const w = Number(weight)
    const l = Number(length)
    const wi = Number(width)
    const h = Number(height)
    if (!Number.isFinite(w) || w <= 0) {
      toast.error('Enter a valid weight')
      return
    }
    if (![l, wi, h].every((n) => Number.isFinite(n) && n > 0)) {
      toast.error('Enter valid length, width, and height (all greater than zero)')
      return
    }

    const payload = {
      rate_options: { carrier_ids: selectedIds },
      shipment: buildShipmentBody(shipFrom, shipTo, {
        weightValue: w,
        weightUnit,
        length: l,
        width: wi,
        height: h,
        dimUnit,
        packageCode,
        validateAddress,
      }),
    }

    setSingleBusy(true)
    setSingleResult(null)
    try {
      const data = await runRates(payload)
      setSingleResult(data)
      toast.success('Rates loaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rate request failed')
      setSingleResult({ error: String(e) })
    } finally {
      setSingleBusy(false)
    }
  }

  const singleRates = useMemo(() => {
    if (!singleResult) return []
    return extractRatesFromApiEnvelope(singleResult)
  }, [singleResult])

  const sortedRates = useMemo(() => {
    const rows = [...singleRates]
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'price') {
        return (rateMoneyTotal(a).total - rateMoneyTotal(b).total) * dir
      }
      if (sortKey === 'delivery') {
        const da = typeof a.delivery_days === 'number' ? a.delivery_days : 999
        const db = typeof b.delivery_days === 'number' ? b.delivery_days : 999
        return (da - db) * dir
      }
      const sa = String(a.service_type ?? a.service_code ?? '')
      const sb = String(b.service_type ?? b.service_code ?? '')
      return sa.localeCompare(sb) * dir
    })
    return rows
  }, [singleRates, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'price' ? 'asc' : 'asc')
    }
  }

  const sortIcon = (key: SortKey) =>
    sortKey !== key ? null : sortDir === 'asc' ? (
      <ChevronUp className="inline h-4 w-4" />
    ) : (
      <ChevronDown className="inline h-4 w-4" />
    )

  const handleCompare = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one carrier')
      return
    }
    setCompareBusy(true)
    setCompareResults(null)
    const outcomes: { row: CompareRow; envelope: unknown; error?: string }[] = []

    try {
      for (const row of compareRows) {
        const w = Number(row.weightOz)
        const l = Number(row.lengthIn)
        const wi = Number(row.widthIn)
        const h = Number(row.heightIn)
        if (!Number.isFinite(w) || w <= 0 || ![l, wi, h].every((n) => Number.isFinite(n) && n > 0)) {
          outcomes.push({
            row,
            envelope: null,
            error: 'Invalid weight or dimensions',
          })
          continue
        }
        const payload = {
          rate_options: { carrier_ids: selectedIds },
          shipment: buildShipmentBody(shipFrom, shipTo, {
            weightValue: w,
            weightUnit: 'ounce',
            length: l,
            width: wi,
            height: h,
            dimUnit: 'inch',
            packageCode: 'package',
            validateAddress,
          }),
        }
        try {
          const data = await runRates(payload)
          outcomes.push({ row, envelope: data })
        } catch (e) {
          outcomes.push({
            row,
            envelope: null,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }
      setCompareResults(outcomes)
      toast.success('Comparison complete')
    } finally {
      setCompareBusy(false)
    }
  }

  const pushCurrentPackageToCompare = () => {
    const w = Number(weight)
    let weightOz = weight
    if (Number.isFinite(w) && w > 0) {
      if (weightUnit === 'pound') weightOz = String(Math.round(w * 16))
      else if (weightUnit === 'ounce') weightOz = String(w)
      else if (weightUnit === 'kilogram') weightOz = String(Math.round(w * 35.274))
      else if (weightUnit === 'gram') weightOz = String(Math.round(w * 0.035274))
    }
    setCompareRows((rows) => [
      ...rows,
      newCompareRow({
        label: activePresetId
          ? (TIER_CEILING_PRESETS.find((p) => p.id === activePresetId)?.label ??
              EXAMPLE_BOARD_PRESETS.find((p) => p.id === activePresetId)?.label ??
              SIZE_LADDER_PRESETS.find((p) => p.id === activePresetId)?.label ??
              `Custom ${rows.length + 1}`)
          : `Custom ${rows.length + 1}`,
        weightOz,
        lengthIn: length,
        widthIn: width,
        heightIn: height,
      }),
    ])
    toast.message('Added a row — adjust label and values as needed')
  }

  if (carrierIds.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-border bg-card">
        <CardHeader className="space-y-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Scale className="h-4 w-4" aria-hidden />
          </span>
          <CardTitle className="text-lg font-semibold tracking-tight">Rate calculator</CardTitle>
          <CardDescription className="text-sm">
            No carrier accounts found. Connect carriers in the ShipEngine dashboard, then refresh.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <ReswellUpsCarrierStatus carriers={carriers} />

      <Card className={surfaceCard}>
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Scale className="h-4 w-4" aria-hidden />
            </span>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Surfboard rate calculator
              </CardTitle>
              <CardDescription className="text-sm">
                Research live carrier rates across ship-from / ship-to lanes and Reswell package
                sizes (shortboard · midlength · longboard). Use presets and the lane matrix below
                to lock accurate checkout rates.{' '}
                <Link
                  href="https://www.shipengine.com/docs/rates/"
                  className="font-medium text-foreground/80 underline decoration-border underline-offset-4 hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Rates docs
                </Link>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-2">
          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Carriers
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 rounded-xl px-4 text-[13px] font-medium"
                  onClick={selectReswellUpsOnly}
                  disabled={!carrierIds.includes(RESWELL_UPS_CARRIER_ID)}
                >
                  Reswell UPS only
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl px-4 text-[13px] font-medium"
                  onClick={selectAllCarriers}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl px-4 text-[13px] font-medium"
                  onClick={clearCarriers}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {carriers.map((c) => {
                const id = typeof c.carrier_id === 'string' ? c.carrier_id : ''
                if (!id) return null
                const label = String(c.friendly_name ?? c.nickname ?? c.carrier_code ?? id)
                const isReswellUps = isReswellUpsCarrier(c)
                return (
                  <label
                    key={id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-2.5 text-[13px] transition-colors hover:bg-muted/40',
                      isReswellUps
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border/50 bg-background/40',
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.includes(id)}
                      onCheckedChange={() => {
                        toggleCarrier(id)
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium" title={label}>
                          {label}
                        </span>
                        {isReswellUps ? (
                          <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                            Reswell UPS
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground" title={id}>
                        {id}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ship-from → ship-to routes
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Load a coastal or cross-country corridor, or edit the address forms below.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 rounded-xl px-4 text-[13px] font-medium"
                onClick={swapAddresses}
              >
                <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
                Swap from / to
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {RATE_SEED_LISTINGS.map((seed) => (
                <Button
                  key={seed.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  title={seed.description}
                  className="h-9 rounded-full border border-border/50 bg-muted/50 px-4 text-[13px] font-medium shadow-none hover:bg-muted"
                  onClick={() => {
                    setShipFrom({ ...seed.shipFrom })
                    setShipTo({ ...seed.shipTo })
                    toast.message(`Loaded route: ${seed.description}`)
                  }}
                >
                  {seed.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ship from
              </h3>
              <AddressForm
                formId="ship-from"
                inputClassName={inputClass}
                selectTriggerClassName={selectTriggerClass}
                value={shipFrom}
                onChange={setShipFrom}
              />
            </div>
            <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ship to
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(['no', 'yes'] as const).map((res) => (
                    <Button
                      key={res}
                      type="button"
                      variant={shipTo.residential === res ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-8 rounded-full px-3 text-[12px]"
                      onClick={() => setShipTo((a) => ({ ...a, residential: res }))}
                    >
                      {res === 'yes' ? 'Residential' : 'Commercial'}
                    </Button>
                  ))}
                </div>
              </div>
              <AddressForm
                formId="ship-to"
                inputClassName={inputClass}
                selectTriggerClassName={selectTriggerClass}
                value={shipTo}
                onChange={setShipTo}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/10 p-4 sm:p-5">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Package size
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Load a Reswell tier ceiling, an example board pack, or a length ladder step — then
                tweak weight / dims and get rates.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground/85">Tier ceilings (checkout)</p>
              <div className="flex flex-wrap gap-2">
                {TIER_CEILING_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={activePresetId === preset.id ? 'default' : 'secondary'}
                    size="sm"
                    title={preset.description}
                    className="h-9 rounded-full px-4 text-[13px] font-medium"
                    onClick={() => applyPackagePreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground/85">Example boards</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_BOARD_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={activePresetId === preset.id ? 'default' : 'outline'}
                    size="sm"
                    title={preset.description}
                    className="h-9 rounded-full px-4 text-[13px] font-medium"
                    onClick={() => applyPackagePreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground/85">Size ladder</p>
              <div className="flex flex-wrap gap-2">
                {SIZE_LADDER_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={activePresetId === preset.id ? 'default' : 'outline'}
                    size="sm"
                    title={preset.description}
                    className="h-9 rounded-full border-dashed px-3 text-[12px] font-medium"
                    onClick={() => applyPackagePreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="rc-board-length" className="text-[13px] font-medium text-foreground/90">
                  Board length → packed carton
                </Label>
                <Input
                  id="rc-board-length"
                  value={boardLengthInput}
                  onChange={(e) => setBoardLengthInput(e.target.value)}
                  placeholder="6'2 or 5.10 or 9'6"
                  className={inputClass}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-11 shrink-0 rounded-xl px-5 text-[13px] font-medium"
                onClick={applyBoardLengthToPackage}
              >
                Apply packed dims
              </Button>
            </div>

            {packageDimIn != null ? (
              <div
                className={cn(
                  'rounded-xl border px-3.5 py-2.5 text-[13px]',
                  packageDimIn > SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN
                    ? 'border-amber-400/50 bg-amber-50/60 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100'
                    : 'border-emerald-400/40 bg-emerald-50/50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100',
                )}
              >
                <span className="font-medium">
                  DIM {packageDimIn}″
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  (L + 2W + 2H) · Reswell UPS parcel cap {SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN}″
                  {packageDimIn > SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN
                    ? ' — over parcel cap; freight / midlength·longboard territory'
                    : ' — within UPS parcel'}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="rc-weight" className="text-[13px] font-medium text-foreground/90">
                Weight
              </Label>
              <div className="flex gap-2">
                <Input
                  id="rc-weight"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className={inputClass}
                />
                <Select
                  value={weightUnit}
                  onValueChange={(v) => setWeightUnit(v as typeof weightUnit)}
                >
                  <SelectTrigger className={`w-[120px] ${selectTriggerClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ounce">oz</SelectItem>
                    <SelectItem value="pound">lb</SelectItem>
                    <SelectItem value="gram">g</SelectItem>
                    <SelectItem value="kilogram">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-foreground/90">
                Dimensions (L × W × H)
              </Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  className={`w-[4.5rem] ${inputClass}`}
                  inputMode="decimal"
                  placeholder="L"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
                <Input
                  className={`w-[4.5rem] ${inputClass}`}
                  inputMode="decimal"
                  placeholder="W"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
                <Input
                  className={`w-[4.5rem] ${inputClass}`}
                  inputMode="decimal"
                  placeholder="H"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
                <Select value={dimUnit} onValueChange={(v) => setDimUnit(v as typeof dimUnit)}>
                  <SelectTrigger className={`w-[110px] ${selectTriggerClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inch">in</SelectItem>
                    <SelectItem value="centimeter">cm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rc-pkg" className="text-[13px] font-medium text-foreground/90">
                Package code
              </Label>
              <Input
                id="rc-pkg"
                value={packageCode}
                onChange={(e) => setPackageCode(e.target.value)}
                placeholder="package"
                className={inputClass}
              />
              <p className="text-[12px] leading-snug text-muted-foreground">
                Carrier-specific; generic is usually fine.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-foreground/90">Address validation</Label>
              <Select
                value={validateAddress}
                onValueChange={(v) => setValidateAddress(v as typeof validateAddress)}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_validation">None (fastest)</SelectItem>
                  <SelectItem value="validate_only">Validate only</SelectItem>
                  <SelectItem value="validate_and_clean">Validate &amp; clean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11 px-8 text-[15px] font-medium"
              onClick={() => void handleSingleCalculate()}
              disabled={singleBusy}
            >
              {singleBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Get rates
            </Button>
            {sortedRates.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-5 text-[13px] font-medium"
                onClick={() => {
                  downloadRatesCsv(sortedRates, {
                    from: `${shipFrom.city_locality}, ${shipFrom.state_province} ${shipFrom.postal_code}`,
                    to: `${shipTo.city_locality}, ${shipTo.state_province} ${shipTo.postal_code}`,
                    packageLine: `${weight} ${weightUnit} · ${length}×${width}×${height} ${dimUnit}`,
                  })
                  toast.success('Rates CSV downloaded')
                }}
              >
                Export results CSV
              </Button>
            ) : null}
          </div>

          {sortedRates.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Results · {sortedRates.length} options
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  Total includes shipping, insurance, confirmation, and other line items.
                </p>
              </div>
              <div className={`overflow-x-auto ${shipTableShell}`}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className={`w-[120px] cursor-pointer ${shipTh}`} onClick={() => toggleSort('price')}>
                        Total {sortIcon('price')}
                      </TableHead>
                      <TableHead className={shipTh}>Carrier</TableHead>
                      <TableHead className={`font-mono text-xs ${shipTh}`}>carrier_id</TableHead>
                      <TableHead
                        className={`cursor-pointer min-w-[180px] ${shipTh}`}
                        onClick={() => toggleSort('service')}
                      >
                        Service {sortIcon('service')}
                      </TableHead>
                      <TableHead className={`cursor-pointer w-[100px] ${shipTh}`} onClick={() => toggleSort('delivery')}>
                        Days {sortIcon('delivery')}
                      </TableHead>
                      <TableHead className={`min-w-[140px] ${shipTh}`}>Est. delivery</TableHead>
                      <TableHead className={`font-mono text-xs ${shipTh}`}>rate_id</TableHead>
                      <TableHead className={shipTh}>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRates.map((r, i) => {
                      const { total, currency } = rateMoneyTotal(r)
                      const attrs = Array.isArray(r.rate_attributes)
                        ? (r.rate_attributes as string[])
                        : []
                      const warnings = Array.isArray(r.warning_messages)
                        ? (r.warning_messages as string[])
                        : []
                      return (
                        <TableRow key={String(r.rate_id ?? i)}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {currency.toUpperCase()} {total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{String(r.carrier_friendly_name ?? r.carrier_code ?? '—')}</span>
                              {isReswellUpsCarrierId(
                                typeof r.carrier_id === 'string' ? r.carrier_id : null,
                              ) ? (
                                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                                  Reswell UPS
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell
                            className="font-mono text-[10px] max-w-[120px] truncate"
                            title={String(r.carrier_id ?? '')}
                          >
                            {String(r.carrier_id ?? '—')}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-medium">{String(r.service_type ?? '—')}</span>
                            <div className="text-xs text-muted-foreground font-mono">
                              {String(r.service_code ?? '')}
                            </div>
                          </TableCell>
                          <TableCell>{r.delivery_days != null ? String(r.delivery_days) : '—'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.estimated_delivery_date
                              ? String(r.estimated_delivery_date).slice(0, 16)
                              : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-[10px] max-w-[120px] truncate" title={String(r.rate_id)}>
                            {String(r.rate_id ?? '—')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {attrs.map((a) => (
                                <Badge key={a} variant="secondary" className="text-[10px]">
                                  {a}
                                </Badge>
                              ))}
                              {warnings.length > 0 ? (
                                <Badge variant="outline" className="text-[10px]" title={warnings.join('\n')}>
                                  warning
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : singleResult ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-3 text-[14px] text-muted-foreground">
              No rates in this response — expand <strong className="font-medium text-foreground/80">Raw response</strong>{' '}
              below or check <code className="rounded bg-muted/80 px-1 font-mono text-[12px]">invalid_rates</code>.
            </p>
          ) : null}

          {singleResult ? (
            <details className="rounded-2xl border border-border/50 bg-muted/10 transition-colors hover:bg-muted/20">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  Raw API response
                  <ChevronDown className="h-4 w-4 opacity-50" strokeWidth={1.5} />
                </span>
              </summary>
              <pre className="mx-3 mb-3 max-h-64 overflow-x-auto rounded-xl border border-border/40 bg-black/[0.03] p-4 font-mono text-[11px] leading-relaxed dark:bg-white/[0.04]">
                {JSON.stringify(singleResult, null, 2)}
              </pre>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Compare package sizes (same lane)
          </CardTitle>
          <CardDescription className="text-sm">
            Same origin, destination, and carriers — one rates request per row. Defaults to the
            three Reswell tier ceilings so you can see shortboard vs midlength vs longboard on one
            corridor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          <div className="overflow-x-auto rounded-2xl border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className={shipTh}>Label</TableHead>
                  <TableHead className={shipTh}>Weight (oz)</TableHead>
                  <TableHead className={shipTh}>L (in)</TableHead>
                  <TableHead className={shipTh}>W (in)</TableHead>
                  <TableHead className={shipTh}>H (in)</TableHead>
                  <TableHead className={shipTh} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {compareRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Input
                        value={row.label}
                        className={`${inputClass} h-10 text-[13px]`}
                        onChange={(e) =>
                          setCompareRows((rows) =>
                            rows.map((x) =>
                              x.id === row.id ? { ...x, label: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={row.weightOz}
                        className={`${inputClass} h-10 text-[13px]`}
                        onChange={(e) =>
                          setCompareRows((rows) =>
                            rows.map((x) =>
                              x.id === row.id ? { ...x, weightOz: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={row.lengthIn}
                        className={`${inputClass} h-10 text-[13px]`}
                        onChange={(e) =>
                          setCompareRows((rows) =>
                            rows.map((x) =>
                              x.id === row.id ? { ...x, lengthIn: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={row.widthIn}
                        className={`${inputClass} h-10 text-[13px]`}
                        onChange={(e) =>
                          setCompareRows((rows) =>
                            rows.map((x) =>
                              x.id === row.id ? { ...x, widthIn: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={row.heightIn}
                        className={`${inputClass} h-10 text-[13px]`}
                        onChange={(e) =>
                          setCompareRows((rows) =>
                            rows.map((x) =>
                              x.id === row.id ? { ...x, heightIn: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-[13px] text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setCompareRows((rows) => rows.filter((x) => x.id !== row.id))
                        }
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl px-4 text-[13px] font-medium"
              onClick={() => setCompareRows((r) => [...r, newCompareRow()])}
            >
              Add row
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl px-4 text-[13px] font-medium"
              onClick={pushCurrentPackageToCompare}
            >
              From calculator
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl px-4 text-[13px] font-medium"
              onClick={() => {
                setCompareRows(TIER_CEILING_PRESETS.map(compareRowFromPreset))
                toast.message('Loaded three tier ceilings')
              }}
            >
              Load tier ceilings
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl px-4 text-[13px] font-medium"
              onClick={() => {
                setCompareRows(SIZE_LADDER_PRESETS.map(compareRowFromPreset))
                toast.message('Loaded size ladder rows')
              }}
            >
              Load size ladder
            </Button>
            <Button
              type="button"
              className="h-10 px-6 text-[14px] font-medium"
              onClick={() => void handleCompare()}
              disabled={compareBusy}
            >
              {compareBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Compare all
            </Button>
          </div>

          {compareResults && compareResults.length > 0 ? (
            <div className="space-y-6">
              {compareResults.map(({ row, envelope, error }) => {
                const rates = envelope ? extractRatesFromApiEnvelope(envelope) : []
                const best = rates.reduce(
                  (bestR, r) => {
                    const t = rateMoneyTotal(r).total
                    if (!bestR || t < bestR.total) return { r, total: t }
                    return bestR
                  },
                  null as null | { r: Record<string, unknown>; total: number },
                )
                return (
                  <Card key={row.id} className="overflow-hidden rounded-2xl border-border/50 shadow-sm">
                    <CardHeader className="border-b border-border/40 bg-muted/10 py-4">
                      <CardTitle className="text-base font-semibold tracking-tight">{row.label}</CardTitle>
                      <CardDescription className="text-[14px]">
                        {row.weightOz} oz · {row.lengthIn}×{row.widthIn}×{row.heightIn} in
                        {best ? (
                          <span className="mt-1 block font-medium text-foreground sm:mt-0 sm:ml-2 sm:inline">
                            Best {rateMoneyTotal(best.r).currency.toUpperCase()} {best.total.toFixed(2)} —{' '}
                            {String(best.r.service_type ?? best.r.service_code ?? '')}
                          </span>
                        ) : null}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {error ? (
                        <p className="text-[14px] text-destructive">{error}</p>
                      ) : rates.length === 0 ? (
                        <p className="text-[14px] text-muted-foreground">No rates returned</p>
                      ) : (
                        <div className={`overflow-x-auto ${shipTableShell}`}>
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border/40 hover:bg-transparent">
                                <TableHead className={shipTh}>Total</TableHead>
                                <TableHead className={shipTh}>Carrier</TableHead>
                                <TableHead className={shipTh}>Service</TableHead>
                                <TableHead className={shipTh}>Days</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[...rates]
                                .sort((a, b) => rateMoneyTotal(a).total - rateMoneyTotal(b).total)
                                .map((r, i) => {
                                  const { total, currency } = rateMoneyTotal(r)
                                  return (
                                    <TableRow key={String(r.rate_id ?? i)}>
                                      <TableCell className="font-medium whitespace-nowrap">
                                        {currency.toUpperCase()} {total.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {String(r.carrier_friendly_name ?? r.carrier_code)}
                                      </TableCell>
                                      <TableCell className="text-sm">{String(r.service_type ?? '—')}</TableCell>
                                      <TableCell>{r.delivery_days != null ? String(r.delivery_days) : '—'}</TableCell>
                                    </TableRow>
                                  )
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ShortboardRateCliffSweep selectedCarrierIds={selectedIds} />

      <RateLaneMatrix
        selectedCarrierIds={selectedIds}
        validateAddress={validateAddress}
      />

      <Card className={surfaceCard}>
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-base font-semibold tracking-tight">Rate a listing as the buyer would</CardTitle>
          <CardDescription className="text-[14px] leading-relaxed">
            Hits the same shared <code className="rounded bg-muted/80 px-1 font-mono text-[12px]">getCheapestReswellRateForListing</code>{' '}
            function used by <code className="rounded bg-muted/80 px-1 font-mono text-[12px]">/checkout</code>. Use this
            to confirm the listing-driven payload (saved packed dims, geocoded ship-from) matches what you build above.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <ListingRateDiagnostic
            onApplyToCalculator={(extracted) => {
              setShipFrom(extracted.shipFrom ?? defaultFrom)
              setShipTo(extracted.shipTo ?? defaultTo)
              setWeight(String(extracted.weightValue))
              setWeightUnit(extracted.weightUnit)
              setLength(String(extracted.length))
              setWidth(String(extracted.width))
              setHeight(String(extracted.height))
              setDimUnit(extracted.dimUnit)
              setPackageCode(extracted.packageCode)
              toast.success(
                'Loaded — scroll up and click Get rates to compare against the listing rate.',
              )
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
          />
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base font-semibold tracking-tight">Manual JSON</CardTitle>
          <CardDescription className="text-[14px] leading-relaxed">
            Advanced — full <code className="rounded bg-muted/80 px-1 font-mono text-[12px]">POST /v1/rates</code> body.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-9 rounded-full px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setJsonOpen((o) => !o)}
          >
            {jsonOpen ? 'Hide editor' : 'Show editor'}
          </Button>
          {jsonOpen ? (
            <>
              <Textarea
                className="min-h-[220px] rounded-2xl border-border/60 bg-background/80 font-mono text-[12px] leading-relaxed shadow-inner"
                placeholder='{ "rate_options": { "carrier_ids": ["se-…"] }, "shipment": { ... } }'
                value={manualJson}
                onChange={(e) => setManualJson(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-xl px-4 text-[13px] font-medium"
                  onClick={() => {
                    try {
                      const w = Number(weight)
                      const l = Number(length)
                      const wi = Number(width)
                      const h = Number(height)
                      const built = {
                        rate_options: { carrier_ids: selectedIds },
                        shipment: buildShipmentBody(shipFrom, shipTo, {
                          weightValue: w,
                          weightUnit,
                          length: l,
                          width: wi,
                          height: h,
                          dimUnit,
                          packageCode,
                          validateAddress,
                        }),
                      }
                      setManualJson(JSON.stringify(built, null, 2))
                      toast.success('Filled from calculator')
                    } catch {
                      toast.error('Could not build JSON')
                    }
                  }}
                >
                  Fill from calculator
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-10 rounded-full px-5 text-[13px] font-medium shadow-sm"
                  disabled={manualBusy}
                  onClick={() => {
                    let payload: unknown
                    try {
                      payload = JSON.parse(manualJson || '{}') as unknown
                    } catch {
                      toast.error('Invalid JSON')
                      return
                    }
                    void (async () => {
                      setManualBusy(true)
                      setSingleResult(null)
                      try {
                        const data = await runRates(payload as object)
                        setSingleResult(data)
                        toast.success('Rates loaded')
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Request failed')
                        setSingleResult({ error: String(e) })
                      } finally {
                        setManualBusy(false)
                      }
                    })()
                  }}
                >
                  {manualBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span className={manualBusy ? 'ml-2' : ''}>Send manual request</span>
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
