'use client'

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Loader2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  buildShipmentBody,
  extractRatesFromApiEnvelope,
  rateMoneyTotal,
} from '@/lib/shipping/shipengine-rate-helpers'
import type { AddressFields } from './address-fields'
import {
  ALL_RATE_PACKAGE_PRESETS,
  TIER_CEILING_PRESETS,
  type RatePackagePreset,
} from './rate-package-presets'
import {
  DEFAULT_MATRIX_DESTINATION_IDS,
  DEFAULT_MATRIX_ORIGIN_IDS,
  MATRIX_QUOTE_HARD_WARN,
  MATRIX_QUOTE_SOFT_WARN,
  USA_HUB_REGION_LABELS,
  USA_HUB_REGION_ORDER,
  USA_SHIPPING_HUBS,
  type UsaHubRegion,
  type UsaShippingHub,
} from './rate-usa-hubs'

const surfaceCard = 'rounded-2xl border border-border bg-card'
const shipTh = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-11'

type MatrixCell =
  | {
      ok: true
      total: number
      currency: string
      carrierName: string
      serviceName: string
      deliveryDays: number | null
    }
  | {
      ok: false
      error: string
    }

type QuoteJob = {
  origin: UsaShippingHub
  destination: UsaShippingHub
  pkg: RatePackagePreset
  key: string
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function cheapestFromEnvelope(envelope: unknown): MatrixCell {
  const rates = extractRatesFromApiEnvelope(envelope)
  if (rates.length === 0) {
    return { ok: false, error: 'No rates returned' }
  }
  let best: MatrixCell | null = null
  for (const r of rates) {
    const { total, currency } = rateMoneyTotal(r)
    if (!best || (best.ok && total < best.total)) {
      best = {
        ok: true,
        total,
        currency,
        carrierName: String(r.carrier_friendly_name ?? r.carrier_code ?? '—'),
        serviceName: String(r.service_type ?? r.service_code ?? '—'),
        deliveryDays: typeof r.delivery_days === 'number' ? r.delivery_days : null,
      }
    }
  }
  return best ?? { ok: false, error: 'No rates returned' }
}

function cellKey(originId: string, destId: string, packageId: string): string {
  return `${originId}::${destId}::${packageId}`
}

function withDestinationResidential(
  address: AddressFields,
  residential: AddressFields['residential'],
): AddressFields {
  return { ...address, residential }
}

function HubMultiSelect({
  title,
  hubs,
  selectedIds,
  onToggle,
  onSelectRegion,
  onClear,
  onSelectDefaults,
}: {
  title: string
  hubs: UsaShippingHub[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onSelectRegion: (region: UsaHubRegion) => void
  onClear: () => void
  onSelectDefaults: () => void
}) {
  const byRegion = useMemo(() => {
    return USA_HUB_REGION_ORDER.map((region) => ({
      region,
      label: USA_HUB_REGION_LABELS[region],
      hubs: hubs.filter((h) => h.region === region),
    })).filter((g) => g.hubs.length > 0)
  }, [hubs])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title} ({selectedIds.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl px-3 text-[12px]"
            onClick={onSelectDefaults}
          >
            Defaults
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl px-3 text-[12px]"
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {USA_HUB_REGION_ORDER.map((region) => {
          const count = hubs.filter((h) => h.region === region).length
          if (count === 0) return null
          return (
            <Button
              key={region}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2.5 text-[11px] text-muted-foreground"
              onClick={() => onSelectRegion(region)}
            >
              + {USA_HUB_REGION_LABELS[region]}
            </Button>
          )
        })}
      </div>
      <div className="max-h-[280px] space-y-4 overflow-y-auto rounded-2xl border border-border/40 bg-muted/10 p-3">
        {byRegion.map((group) => (
          <div key={group.region} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {group.hubs.map((hub) => {
                const on = selectedIds.includes(hub.id)
                return (
                  <label
                    key={hub.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] transition-colors',
                      on
                        ? 'border-sky-500/40 bg-sky-500/8'
                        : 'border-transparent bg-background/50 hover:bg-muted/40',
                    )}
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => onToggle(hub.id)}
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{hub.label}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                        {hub.address.postal_code}
                        {hub.address.residential === 'yes' ? ' · residential' : ''}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function priceTone(
  total: number,
  min: number,
  max: number,
): string {
  if (max <= min) return 'bg-muted/20'
  const t = (total - min) / (max - min)
  if (t <= 0.33) return 'bg-emerald-500/10'
  if (t <= 0.66) return 'bg-amber-500/10'
  return 'bg-rose-500/10'
}

export function RateLaneMatrix({
  selectedCarrierIds,
  validateAddress,
}: {
  selectedCarrierIds: string[]
  validateAddress: 'no_validation' | 'validate_only' | 'validate_and_clean'
}) {
  const [originIds, setOriginIds] = useState<string[]>([...DEFAULT_MATRIX_ORIGIN_IDS])
  const [destinationIds, setDestinationIds] = useState<string[]>([
    ...DEFAULT_MATRIX_DESTINATION_IDS,
  ])
  const [presetIds, setPresetIds] = useState<string[]>(() =>
    TIER_CEILING_PRESETS.map((p) => p.id),
  )
  const [skipSameHub, setSkipSameHub] = useState(true)
  const [forceResidentialDest, setForceResidentialDest] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [cells, setCells] = useState<Record<string, MatrixCell> | null>(null)
  const [viewPackageId, setViewPackageId] = useState<string>(
    TIER_CEILING_PRESETS[0]?.id ?? '',
  )
  const cancelRef = useRef(false)

  const origins = useMemo(
    () => USA_SHIPPING_HUBS.filter((h) => originIds.includes(h.id)),
    [originIds],
  )
  const destinations = useMemo(
    () => USA_SHIPPING_HUBS.filter((h) => destinationIds.includes(h.id)),
    [destinationIds],
  )
  const packages = useMemo(
    () => ALL_RATE_PACKAGE_PRESETS.filter((p) => presetIds.includes(p.id)),
    [presetIds],
  )

  const jobs = useMemo((): QuoteJob[] => {
    const out: QuoteJob[] = []
    for (const origin of origins) {
      for (const destination of destinations) {
        if (skipSameHub && origin.id === destination.id) continue
        for (const pkg of packages) {
          out.push({
            origin,
            destination,
            pkg,
            key: cellKey(origin.id, destination.id, pkg.id),
          })
        }
      }
    }
    return out
  }, [destinations, origins, packages, skipSameHub])

  const quoteCount = jobs.length

  const toggleId = useCallback((setter: Dispatch<SetStateAction<string[]>>, id: string) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const selectRegion = useCallback(
    (setter: Dispatch<SetStateAction<string[]>>, region: UsaHubRegion) => {
      const ids = USA_SHIPPING_HUBS.filter((h) => h.region === region).map((h) => h.id)
      setter((prev) => Array.from(new Set([...prev, ...ids])))
    },
    [],
  )

  const togglePreset = useCallback((id: string) => {
    setPresetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const runMatrix = useCallback(async () => {
    if (selectedCarrierIds.length === 0) {
      toast.error('Select at least one carrier above')
      return
    }
    if (origins.length === 0) {
      toast.error('Select at least one origin')
      return
    }
    if (destinations.length === 0) {
      toast.error('Select at least one destination')
      return
    }
    if (packages.length === 0) {
      toast.error('Select at least one package size')
      return
    }
    if (quoteCount === 0) {
      toast.error('No quotes to run — check skip same-hub or selections')
      return
    }
    if (quoteCount > MATRIX_QUOTE_HARD_WARN) {
      const ok = window.confirm(
        `This will request ${quoteCount} live ShipEngine quotes sequentially (can take several minutes). Continue?`,
      )
      if (!ok) return
    } else if (quoteCount > MATRIX_QUOTE_SOFT_WARN) {
      toast.message(`${quoteCount} quotes — this may take a few minutes`, {
        description: 'Requests run one at a time to stay under API limits.',
      })
    }

    cancelRef.current = false
    setBusy(true)
    setCells(null)
    setProgress({ done: 0, total: quoteCount })
    if (packages[0]) setViewPackageId(packages[0].id)

    const next: Record<string, MatrixCell> = {}
    let done = 0

    try {
      for (const job of jobs) {
        if (cancelRef.current) {
          toast.message('Stopped early', {
            description: `${done} of ${quoteCount} quotes completed`,
          })
          break
        }

        const shipTo = forceResidentialDest
          ? withDestinationResidential(job.destination.address, 'yes')
          : job.destination.address

        const payload = {
          rate_options: { carrier_ids: selectedCarrierIds },
          shipment: buildShipmentBody(job.origin.address, shipTo, {
            weightValue: job.pkg.weightLb,
            weightUnit: 'pound',
            length: job.pkg.lengthIn,
            width: job.pkg.widthIn,
            height: job.pkg.heightIn,
            dimUnit: 'inch',
            packageCode: 'package',
            validateAddress,
          }),
        }

        try {
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
            next[job.key] = {
              ok: false,
              error: typeof err === 'string' ? err : JSON.stringify(err),
            }
          } else {
            next[job.key] = cheapestFromEnvelope(data)
          }
        } catch (e) {
          next[job.key] = {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          }
        }

        done += 1
        setCells({ ...next })
        setProgress({ done, total: quoteCount })
      }

      if (!cancelRef.current) {
        toast.success(`USA rate matrix complete — ${done} quotes`)
      }
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [
    destinations.length,
    forceResidentialDest,
    jobs,
    origins.length,
    packages,
    quoteCount,
    selectedCarrierIds,
    validateAddress,
  ])

  const stopMatrix = useCallback(() => {
    cancelRef.current = true
  }, [])

  const exportLongCsv = useCallback(() => {
    if (!cells) {
      toast.error('Run the matrix first')
      return
    }
    const header = [
      'Origin',
      'Origin region',
      'Origin ZIP',
      'Destination',
      'Destination region',
      'Destination ZIP',
      'Package',
      'Tier',
      'Weight lb',
      'L',
      'W',
      'H',
      'Total',
      'Currency',
      'Carrier',
      'Service',
      'Days',
      'Error',
    ]
    const rows: string[][] = []
    for (const job of jobs) {
      const cell = cells[job.key]
      rows.push([
        job.origin.label,
        USA_HUB_REGION_LABELS[job.origin.region],
        job.origin.address.postal_code,
        job.destination.label,
        USA_HUB_REGION_LABELS[job.destination.region],
        job.destination.address.postal_code,
        job.pkg.label,
        job.pkg.tierId ?? '',
        String(job.pkg.weightLb),
        String(job.pkg.lengthIn),
        String(job.pkg.widthIn),
        String(job.pkg.heightIn),
        cell?.ok ? cell.total.toFixed(2) : '',
        cell?.ok ? cell.currency : '',
        cell?.ok ? cell.carrierName : '',
        cell?.ok ? cell.serviceName : '',
        cell?.ok && cell.deliveryDays != null ? String(cell.deliveryDays) : '',
        cell && !cell.ok ? cell.error : '',
      ])
    }
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
    downloadCsv(csv, `reswell-usa-rate-matrix-${new Date().toISOString().slice(0, 10)}.csv`)
    toast.success('Long-form CSV downloaded')
  }, [cells, jobs])

  const groupedPresets = useMemo(() => {
    const groups: {
      key: RatePackagePreset['group']
      title: string
      items: RatePackagePreset[]
    }[] = [
      { key: 'tier_ceiling', title: 'Tier ceilings (checkout)', items: [] },
      { key: 'example_board', title: 'Example boards', items: [] },
      { key: 'size_ladder', title: 'Size ladder', items: [] },
    ]
    for (const p of ALL_RATE_PACKAGE_PRESETS) {
      groups.find((x) => x.key === p.group)?.items.push(p)
    }
    return groups
  }, [])

  const viewPackage = packages.find((p) => p.id === viewPackageId) ?? packages[0]

  const viewPriceRange = useMemo(() => {
    if (!cells || !viewPackage) return { min: 0, max: 0 }
    let min = Infinity
    let max = -Infinity
    for (const origin of origins) {
      for (const destination of destinations) {
        if (skipSameHub && origin.id === destination.id) continue
        const cell = cells[cellKey(origin.id, destination.id, viewPackage.id)]
        if (cell?.ok) {
          min = Math.min(min, cell.total)
          max = Math.max(max, cell.total)
        }
      }
    }
    if (!Number.isFinite(min)) return { min: 0, max: 0 }
    return { min, max }
  }, [cells, destinations, origins, skipSameHub, viewPackage])

  const quoteWarnClass =
    quoteCount > MATRIX_QUOTE_HARD_WARN
      ? 'text-destructive'
      : quoteCount > MATRIX_QUOTE_SOFT_WARN
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-muted-foreground'

  return (
    <Card className={surfaceCard}>
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold tracking-tight">
              USA rate matrix
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Pick origins and destinations across the country, pick package sizes (tier ceilings,
              example boards, or the size ladder), then pull live cheapest rates for every
              combination. Export CSV to build Reswell checkout rate tables.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 pt-2">
        <div className="grid gap-6 lg:grid-cols-2">
          <HubMultiSelect
            title="Ship from (origins)"
            hubs={USA_SHIPPING_HUBS}
            selectedIds={originIds}
            onToggle={(id) => toggleId(setOriginIds, id)}
            onSelectRegion={(region) => selectRegion(setOriginIds, region)}
            onClear={() => setOriginIds([])}
            onSelectDefaults={() => setOriginIds([...DEFAULT_MATRIX_ORIGIN_IDS])}
          />
          <HubMultiSelect
            title="Ship to (destinations)"
            hubs={USA_SHIPPING_HUBS}
            selectedIds={destinationIds}
            onToggle={(id) => toggleId(setDestinationIds, id)}
            onSelectRegion={(region) => selectRegion(setDestinationIds, region)}
            onClear={() => setDestinationIds([])}
            onSelectDefaults={() => setDestinationIds([...DEFAULT_MATRIX_DESTINATION_IDS])}
          />
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Package sizes ({presetIds.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-xl px-3 text-[12px]"
                onClick={() => setPresetIds(TIER_CEILING_PRESETS.map((p) => p.id))}
              >
                Tier ceilings only
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-xl px-3 text-[12px]"
                onClick={() => setPresetIds(ALL_RATE_PACKAGE_PRESETS.map((p) => p.id))}
              >
                All sizes
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-xl px-3 text-[12px]"
                onClick={() => setPresetIds([])}
              >
                Clear
              </Button>
            </div>
          </div>
          {groupedPresets.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-[12px] font-medium text-foreground/80">{group.title}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((pkg) => {
                  const on = presetIds.includes(pkg.id)
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      title={pkg.description}
                      onClick={() => togglePreset(pkg.id)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
                        on
                          ? 'border-sky-500/50 bg-sky-500/10 text-foreground'
                          : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      {pkg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-muted/10 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox
                checked={skipSameHub}
                onCheckedChange={(v) => setSkipSameHub(v === true)}
              />
              Skip same city (origin = destination)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox
                checked={forceResidentialDest}
                onCheckedChange={(v) => setForceResidentialDest(v === true)}
              />
              Force residential delivery
            </label>
          </div>
          <p className={cn('text-[13px] font-medium', quoteWarnClass)}>
            {origins.length} origins × {destinations.length} destinations × {packages.length}{' '}
            packages = <span className="font-mono">{quoteCount}</span> live quotes
            {quoteCount > MATRIX_QUOTE_SOFT_WARN
              ? ' · large run — sequential, may take a few minutes'
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="h-11 px-6 text-[14px] font-medium"
            disabled={busy || quoteCount === 0}
            onClick={() => void runMatrix()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy && progress
              ? `Quoting ${progress.done}/${progress.total}…`
              : `Run USA matrix (${quoteCount})`}
          </Button>
          {busy ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-5 text-[13px] font-medium"
              onClick={stopMatrix}
            >
              Stop
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-5 text-[13px] font-medium"
            disabled={!cells}
            onClick={exportLongCsv}
          >
            Export CSV
          </Button>
          {busy && progress ? (
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
              {Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%
            </Badge>
          ) : null}
        </div>

        {cells && viewPackage && origins.length > 0 && destinations.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <Label className="text-[12px] font-medium text-muted-foreground">
                  View package
                </Label>
                <Select
                  value={viewPackage.id}
                  onValueChange={setViewPackageId}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl sm:w-[320px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.label} — {pkg.weightLb} lb · {pkg.lengthIn}×{pkg.widthIn}×
                        {pkg.heightIn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {viewPriceRange.max > 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  Cheapest in view{' '}
                  <span className="font-mono font-medium text-foreground">
                    ${viewPriceRange.min.toFixed(2)}
                  </span>
                  {' · '}
                  highest{' '}
                  <span className="font-mono font-medium text-foreground">
                    ${viewPriceRange.max.toFixed(2)}
                  </span>
                  <span className="ml-2 text-muted-foreground/80">
                    (green = lower, rose = higher)
                  </span>
                </p>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className={`sticky left-0 z-10 min-w-[140px] bg-card ${shipTh}`}>
                      From \ To
                    </TableHead>
                    {destinations.map((dest) => (
                      <TableHead key={dest.id} className={`min-w-[120px] ${shipTh}`}>
                        {dest.shortLabel}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {origins.map((origin) => (
                    <TableRow key={origin.id}>
                      <TableCell className="sticky left-0 z-10 bg-card text-[12px] font-medium">
                        {origin.shortLabel}
                      </TableCell>
                      {destinations.map((destination) => {
                        if (skipSameHub && origin.id === destination.id) {
                          return (
                            <TableCell
                              key={destination.id}
                              className="bg-muted/20 text-center text-[11px] text-muted-foreground"
                            >
                              —
                            </TableCell>
                          )
                        }
                        const cell = cells[cellKey(origin.id, destination.id, viewPackage.id)]
                        if (!cell) {
                          return (
                            <TableCell key={destination.id} className="text-muted-foreground">
                              …
                            </TableCell>
                          )
                        }
                        if (!cell.ok) {
                          return (
                            <TableCell
                              key={destination.id}
                              className="max-w-[140px] truncate text-[11px] text-destructive"
                              title={cell.error}
                            >
                              err
                            </TableCell>
                          )
                        }
                        return (
                          <TableCell
                            key={destination.id}
                            className={cn(
                              'text-[12px]',
                              priceTone(cell.total, viewPriceRange.min, viewPriceRange.max),
                            )}
                            title={`${cell.carrierName} · ${cell.serviceName}${
                              cell.deliveryDays != null ? ` · ${cell.deliveryDays}d` : ''
                            }`}
                          >
                            <div className="font-mono font-medium">
                              ${cell.total.toFixed(2)}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {cell.deliveryDays != null ? `${cell.deliveryDays}d` : '—'} ·{' '}
                              {cell.carrierName}
                            </div>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
