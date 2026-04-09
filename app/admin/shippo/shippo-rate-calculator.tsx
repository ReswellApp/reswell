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
import { ChevronDown, ChevronUp, Loader2, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { normalizeUsStateProvinceForShipping } from '@/lib/us-state-name-to-code'
import { AddressForm } from '../shipping/shipping-address-form'
import type { AddressFields } from '../shipping/address-fields'
import { RATE_SEED_LISTINGS } from '../shipping/rate-seed-listings'

const inputClass =
  'h-11 rounded-xl border-border/60 bg-background/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-foreground/[0.06]'
const selectTriggerClass = 'h-11 rounded-xl border-border/60 bg-background/90 shadow-sm'
const surfaceCard =
  'rounded-[1.35rem] border border-border/50 bg-card shadow-[0_2px_32px_-18px_rgba(0,0,0,0.12)]'
const shipTableShell =
  'overflow-hidden rounded-2xl border border-border/50 bg-background/50 shadow-[inset_0_1px_0_rgba(0,0,0,0.03)]'
const shipTh =
  'bg-muted/35 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground h-11'

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

const defaultFrom: AddressFields = {
  name: 'Ship from',
  phone: '555-0100',
  company_name: '',
  address_line1: '300 N Coast Hwy',
  address_line2: '',
  city_locality: 'Oceanside',
  state_province: 'CA',
  postal_code: '92054',
  country_code: 'US',
  residential: 'no',
}

const defaultTo: AddressFields = {
  name: 'Recipient',
  phone: '555-0200',
  company_name: '',
  address_line1: '100 Federal St',
  address_line2: 'Suite 400',
  city_locality: 'Boston',
  state_province: 'MA',
  postal_code: '02110',
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

function toShippoAddress(a: AddressFields): Record<string, unknown> {
  const residential =
    a.residential === 'yes' ? true : a.residential === 'no' ? false : undefined
  const country = (a.country_code.trim().toUpperCase() || 'US').slice(0, 2)
  const o: Record<string, unknown> = {
    name: a.name.trim(),
    street1: a.address_line1.trim(),
    city: a.city_locality.trim(),
    state: normalizeUsStateProvinceForShipping(country, a.state_province),
    zip: a.postal_code.trim(),
    country,
  }
  const s2 = a.address_line2.trim()
  if (s2) o.street2 = s2
  const ph = a.phone.trim()
  if (ph) o.phone = ph
  const co = a.company_name.trim()
  if (co) o.company = co
  if (residential !== undefined) o.is_residential = residential
  return o
}

function buildParcel(
  weightValue: number,
  weightUnit: 'ounce' | 'pound' | 'gram' | 'kilogram',
  length: number,
  width: number,
  height: number,
  dimUnit: 'inch' | 'centimeter',
): Record<string, unknown> {
  const massUnitMap = {
    ounce: 'oz',
    pound: 'lb',
    gram: 'g',
    kilogram: 'kg',
  } as const
  return {
    length: String(length),
    width: String(width),
    height: String(height),
    distance_unit: dimUnit === 'inch' ? 'in' : 'cm',
    weight: String(weightValue),
    mass_unit: massUnitMap[weightUnit],
  }
}

function buildShippoShipmentBody(
  shipFrom: AddressFields,
  shipTo: AddressFields,
  opts: {
    weightValue: number
    weightUnit: 'ounce' | 'pound' | 'gram' | 'kilogram'
    length: number
    width: number
    height: number
    dimUnit: 'inch' | 'centimeter'
    carrierAccountIds: string[]
  },
) {
  return {
    address_from: toShippoAddress(shipFrom),
    address_to: toShippoAddress(shipTo),
    parcels: [
      buildParcel(
        opts.weightValue,
        opts.weightUnit,
        opts.length,
        opts.width,
        opts.height,
        opts.dimUnit,
      ),
    ],
    carrier_accounts: opts.carrierAccountIds,
    async: false,
  }
}

function extractShippoRates(envelope: unknown): Record<string, unknown>[] {
  const root = asRecord(envelope)
  const inner = root?.data !== undefined && root?.data !== null ? root.data : envelope
  const s = asRecord(inner)
  const rates = s?.rates
  return Array.isArray(rates) ? (rates as Record<string, unknown>[]) : []
}

function rateMoneyShippo(r: Record<string, unknown>): { total: number; currency: string } {
  const raw = r.amount
  const n = typeof raw === 'string' ? parseFloat(raw) : typeof raw === 'number' ? raw : NaN
  const currency = typeof r.currency === 'string' ? r.currency : 'usd'
  return { total: Number.isFinite(n) ? n : 0, currency }
}

function serviceLabel(r: Record<string, unknown>): string {
  const sl = asRecord(r.servicelevel)
  return String(sl?.name ?? '—')
}

function serviceToken(r: Record<string, unknown>): string {
  const sl = asRecord(r.servicelevel)
  return String(sl?.token ?? sl?.extended_token ?? '')
}

type SortKey = 'price' | 'delivery' | 'service'

export function ShippoRateCalculator({
  carrierAccounts,
}: {
  carrierAccounts: Record<string, unknown>[]
}) {
  const accountIds = useMemo(
    () =>
      carrierAccounts
        .map((c) => (typeof c.object_id === 'string' ? c.object_id : null))
        .filter(Boolean) as string[],
    [carrierAccounts],
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const carriersSeenRef = useRef(false)

  useEffect(() => {
    if (accountIds.length === 0) return
    if (!carriersSeenRef.current) {
      carriersSeenRef.current = true
      setSelectedIds([...accountIds])
    }
  }, [accountIds])
  const [shipFrom, setShipFrom] = useState<AddressFields>(defaultFrom)
  const [shipTo, setShipTo] = useState<AddressFields>(defaultTo)

  const [weight, setWeight] = useState('48')
  const [weightUnit, setWeightUnit] = useState<'ounce' | 'pound' | 'gram' | 'kilogram'>('ounce')
  const [length, setLength] = useState('72')
  const [width, setWidth] = useState('20')
  const [height, setHeight] = useState('6')
  const [dimUnit, setDimUnit] = useState<'inch' | 'centimeter'>('inch')

  const [singleBusy, setSingleBusy] = useState(false)
  const [singleResult, setSingleResult] = useState<unknown>(null)
  const [sortKey, setSortKey] = useState<SortKey>('price')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [compareRows, setCompareRows] = useState<CompareRow[]>(() => [
    newCompareRow({
      label: 'Light / small',
      weightOz: '32',
      lengthIn: '60',
      widthIn: '18',
      heightIn: '5',
    }),
    newCompareRow({
      label: 'Medium',
      weightOz: '96',
      lengthIn: '84',
      widthIn: '22',
      heightIn: '8',
    }),
    newCompareRow({
      label: 'Heavy / large',
      weightOz: '160',
      lengthIn: '96',
      widthIn: '24',
      heightIn: '10',
    }),
  ])
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
    setSelectedIds([...accountIds])
  }, [accountIds])

  const clearCarriers = useCallback(() => setSelectedIds([]), [])

  const runRates = useCallback(async (payload: object) => {
    const res = await fetch('/api/admin/shippo', {
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
  }, [])

  const handleSingleCalculate = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one carrier account')
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

    const payload = buildShippoShipmentBody(shipFrom, shipTo, {
      weightValue: w,
      weightUnit,
      length: l,
      width: wi,
      height: h,
      dimUnit,
      carrierAccountIds: selectedIds,
    })

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
    return extractShippoRates(singleResult)
  }, [singleResult])

  const sortedRates = useMemo(() => {
    const rows = [...singleRates]
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'price') {
        return (rateMoneyShippo(a).total - rateMoneyShippo(b).total) * dir
      }
      if (sortKey === 'delivery') {
        const da = typeof a.estimated_days === 'number' ? a.estimated_days : 999
        const db = typeof b.estimated_days === 'number' ? b.estimated_days : 999
        return (da - db) * dir
      }
      const sa = serviceLabel(a)
      const sb = serviceLabel(b)
      return sa.localeCompare(sb) * dir
    })
    return rows
  }, [singleRates, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
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
      toast.error('Select at least one carrier account')
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
        const payload = buildShippoShipmentBody(shipFrom, shipTo, {
          weightValue: w,
          weightUnit: 'ounce',
          length: l,
          width: wi,
          height: h,
          dimUnit: 'inch',
          carrierAccountIds: selectedIds,
        })
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
    setCompareRows((rows) => [
      ...rows,
      newCompareRow({
        label: `Custom ${rows.length + 1}`,
        weightOz: weight,
        lengthIn: length,
        widthIn: width,
        heightIn: height,
      }),
    ])
    toast.message('Added a row — adjust label and values as needed')
  }

  if (accountIds.length === 0) {
    return (
      <Card className={`${surfaceCard} border-dashed`}>
        <CardHeader className="space-y-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50">
            <Scale className="h-5 w-5 text-foreground/70" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight">Rate calculator</CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">
            No carrier accounts found. Connect carriers in the Shippo dashboard, then refresh.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <Card className={surfaceCard}>
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/30 ring-1 ring-border/40">
              <Scale className="h-5 w-5 text-foreground/75" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold tracking-tight">Rate calculator</CardTitle>
              <CardDescription className="text-[15px] leading-relaxed">
                Quotes via Shippo{' '}
                <code className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[12px] font-mono">POST /shipments</code>{' '}
                with{' '}
                <code className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[12px] font-mono">async: false</code>.{' '}
                <Link
                  href="https://docs.goshippo.com/docs/shipments/rateshoppingwithcarriers"
                  className="font-medium text-foreground/80 underline decoration-border underline-offset-4 hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Rate shopping
                </Link>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-2">
          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Carrier accounts
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border-border/60 px-4 text-[13px] font-medium"
                  onClick={selectAllCarriers}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border-border/60 px-4 text-[13px] font-medium"
                  onClick={clearCarriers}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {carrierAccounts.map((c) => {
                const id = typeof c.object_id === 'string' ? c.object_id : ''
                if (!id) return null
                const label = String(
                  c.carrier_name ?? c.carrier ?? c.description ?? id,
                )
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/50 bg-background/40 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedIds.includes(id)}
                      onCheckedChange={() => {
                        toggleCarrier(id)
                      }}
                    />
                    <span className="truncate" title={id}>
                      {label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sample routes
              </h3>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Load a preset ship-from and ship-to pair for quick rate checks.
              </p>
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
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ship from
              </h3>
              <AddressForm
                formId="shippo-ship-from"
                inputClassName={inputClass}
                selectTriggerClassName={selectTriggerClass}
                value={shipFrom}
                onChange={setShipFrom}
              />
            </div>
            <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ship to
              </h3>
              <AddressForm
                formId="shippo-ship-to"
                inputClassName={inputClass}
                selectTriggerClassName={selectTriggerClass}
                value={shipTo}
                onChange={setShipTo}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="shippo-rc-weight" className="text-[13px] font-medium text-foreground/90">
                Weight
              </Label>
              <div className="flex gap-2">
                <Input
                  id="shippo-rc-weight"
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
          </div>

          <Button
            type="button"
            className="h-11 rounded-full px-8 text-[15px] font-medium shadow-md transition-all hover:shadow-lg"
            onClick={() => void handleSingleCalculate()}
            disabled={singleBusy}
          >
            {singleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className={singleBusy ? 'ml-2' : ''}>Get rates</span>
          </Button>

          {sortedRates.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Results · {sortedRates.length} options
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  Amounts from Shippo rate objects (account-based pricing).
                </p>
              </div>
              <div className={`overflow-x-auto ${shipTableShell}`}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className={`w-[120px] cursor-pointer ${shipTh}`} onClick={() => toggleSort('price')}>
                        Total {sortIcon('price')}
                      </TableHead>
                      <TableHead className={shipTh}>Provider</TableHead>
                      <TableHead
                        className={`cursor-pointer min-w-[180px] ${shipTh}`}
                        onClick={() => toggleSort('service')}
                      >
                        Service {sortIcon('service')}
                      </TableHead>
                      <TableHead className={`cursor-pointer w-[100px] ${shipTh}`} onClick={() => toggleSort('delivery')}>
                        Days {sortIcon('delivery')}
                      </TableHead>
                      <TableHead className={`min-w-[140px] ${shipTh}`}>ETA</TableHead>
                      <TableHead className={`font-mono text-xs ${shipTh}`}>rate object_id</TableHead>
                      <TableHead className={shipTh}>Attrs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRates.map((r, i) => {
                      const { total, currency } = rateMoneyShippo(r)
                      const attrs = Array.isArray(r.attributes) ? (r.attributes as string[]) : []
                      return (
                        <TableRow key={String(r.object_id ?? i)}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {currency.toUpperCase()} {total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm">{String(r.provider ?? '—')}</TableCell>
                          <TableCell className="text-sm">
                            <span className="font-medium">{serviceLabel(r)}</span>
                            <div className="text-xs text-muted-foreground font-mono">{serviceToken(r)}</div>
                          </TableCell>
                          <TableCell>
                            {r.estimated_days != null ? String(r.estimated_days) : '—'}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.arrives_by ? String(r.arrives_by).slice(0, 16) : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-[10px] max-w-[120px] truncate" title={String(r.object_id)}>
                            {String(r.object_id ?? '—')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {attrs.map((a) => (
                                <Badge key={a} variant="secondary" className="text-[10px]">
                                  {a}
                                </Badge>
                              ))}
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
              No rates in this response — open <strong className="font-medium text-foreground/80">Raw API response</strong>{' '}
              below or check Shippo <code className="rounded bg-muted/80 px-1 font-mono text-[12px]">messages</code>.
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
          <CardTitle className="text-lg font-semibold tracking-tight">Compare package sizes</CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">
            Same origin, destination, and carrier accounts — one shipment request per row.
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
              className="h-10 rounded-full border-border/60 px-4 text-[13px] font-medium"
              onClick={() => setCompareRows((r) => [...r, newCompareRow()])}
            >
              Add row
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-full border-border/60 px-4 text-[13px] font-medium"
              onClick={pushCurrentPackageToCompare}
            >
              From calculator
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full px-6 text-[14px] font-medium shadow-sm"
              onClick={() => void handleCompare()}
              disabled={compareBusy}
            >
              {compareBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className={compareBusy ? 'ml-2' : ''}>Compare all</span>
            </Button>
          </div>

          {compareResults && compareResults.length > 0 ? (
            <div className="space-y-6">
              {compareResults.map(({ row, envelope, error }) => {
                const rates = envelope ? extractShippoRates(envelope) : []
                const best = rates.reduce(
                  (bestR, r) => {
                    const t = rateMoneyShippo(r).total
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
                            Best {rateMoneyShippo(best.r).currency.toUpperCase()} {best.total.toFixed(2)} —{' '}
                            {serviceLabel(best.r)}
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
                                <TableHead className={shipTh}>Provider</TableHead>
                                <TableHead className={shipTh}>Service</TableHead>
                                <TableHead className={shipTh}>Days</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[...rates]
                                .sort((a, b) => rateMoneyShippo(a).total - rateMoneyShippo(b).total)
                                .map((r, i) => {
                                  const { total, currency } = rateMoneyShippo(r)
                                  return (
                                    <TableRow key={String(r.object_id ?? i)}>
                                      <TableCell className="font-medium whitespace-nowrap">
                                        {currency.toUpperCase()} {total.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="text-sm">{String(r.provider ?? '—')}</TableCell>
                                      <TableCell className="text-sm">{serviceLabel(r)}</TableCell>
                                      <TableCell>
                                        {r.estimated_days != null ? String(r.estimated_days) : '—'}
                                      </TableCell>
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

      <Card className={surfaceCard}>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base font-semibold tracking-tight">Manual JSON</CardTitle>
          <CardDescription className="text-[14px] leading-relaxed">
            Advanced — full <code className="rounded bg-muted/80 px-1 font-mono text-[12px]">POST /shipments</code> body
            (async:false applied if omitted).
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
                placeholder='{ "address_from": {...}, "address_to": {...}, "parcels": [...], "carrier_accounts": ["..."] }'
                value={manualJson}
                onChange={(e) => setManualJson(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-full border-border/60 px-4 text-[13px] font-medium"
                  onClick={() => {
                    try {
                      const w = Number(weight)
                      const l = Number(length)
                      const wi = Number(width)
                      const h = Number(height)
                      const built = buildShippoShipmentBody(shipFrom, shipTo, {
                        weightValue: w,
                        weightUnit,
                        length: l,
                        width: wi,
                        height: h,
                        dimUnit,
                        carrierAccountIds: selectedIds,
                      })
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
