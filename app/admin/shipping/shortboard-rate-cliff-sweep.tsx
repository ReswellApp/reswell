'use client'

import { useCallback, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  buildShipmentBody,
  extractRatesFromApiEnvelope,
  rateMoneyTotal,
} from '@/lib/shipping/shipengine-rate-helpers'
import { upsParcelSurchargeFlags } from '@/lib/shipping/ups-parcel-surcharge-flags'
import { SURFBOARD_SHIPPING_PACK_BANDS } from '@/lib/surfboard-shipping-pack-bands'
import type { AddressFields } from './address-fields'
import { USA_SHIPPING_HUBS } from './rate-usa-hubs'

const surfaceCard = 'rounded-2xl border border-border bg-card'
const shipTh = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-11'

const LENGTHS = [66, 68, 70, 72, 74, 76, 78] as const
const WIDTHS = [20, 21, 22, 23, 24, 25, 26, 27] as const
const HEIGHTS = [5, 6, 7] as const
const WEIGHTS = [15, 18, 22] as const

const DEFAULT_LANES = [
  {
    id: 'ca_ca',
    fromId: 'los-angeles-ca',
    toId: 'san-francisco-ca',
    label: 'CA → CA (LA→SF)',
  },
  {
    id: 'ca_ny',
    fromId: 'los-angeles-ca',
    toId: 'new-york-ny',
    label: 'CA → NY (LA→NYC)',
  },
  {
    id: 'ca_hi',
    fromId: 'los-angeles-ca',
    toId: 'honolulu-hi',
    label: 'CA → HI (LA→Honolulu)',
  },
] as const

type SweepCell = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  dimIn: number
  volumeIn3: number
  dimOver130: boolean
  lengthOver96: boolean
  volumeOver10368: boolean
  volumeOver17280: boolean
  largePackageLikely: boolean
  total: number | null
  currency: string | null
  carrierName: string | null
  serviceName: string | null
  error: string | null
  priceJump: boolean
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function csvCell(value: string | number | boolean | null | undefined): string {
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

function hubAddress(hubId: string): AddressFields | null {
  const hub = USA_SHIPPING_HUBS.find((h) => h.id === hubId)
  return hub?.address ?? null
}

function cheapestTotal(envelope: unknown): {
  total: number
  currency: string
  carrierName: string
  serviceName: string
} | null {
  const rates = extractRatesFromApiEnvelope(envelope)
  let best: { total: number; currency: string; carrierName: string; serviceName: string } | null =
    null
  for (const r of rates) {
    const { total, currency } = rateMoneyTotal(r)
    if (!best || total < best.total) {
      best = {
        total,
        currency,
        carrierName: String(r.carrier_friendly_name ?? r.carrier_code ?? '—'),
        serviceName: String(r.service_type ?? r.service_code ?? '—'),
      }
    }
  }
  return best
}

export function ShortboardRateCliffSweep({
  selectedCarrierIds,
}: {
  selectedCarrierIds: string[]
}) {
  const [laneId, setLaneId] = useState<string>(DEFAULT_LANES[1].id)
  const [weightLb, setWeightLb] = useState<string>('18')
  const [heightIn, setHeightIn] = useState<string>('6')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [cells, setCells] = useState<SweepCell[]>([])

  const lane = DEFAULT_LANES.find((l) => l.id === laneId) ?? DEFAULT_LANES[1]

  const grid = useMemo(() => {
    const h = Number(heightIn)
    const w = Number(weightLb)
    const rows: { lengthIn: number; widthIn: number; heightIn: number; weightLb: number }[] = []
    for (const lengthIn of LENGTHS) {
      for (const widthIn of WIDTHS) {
        rows.push({ lengthIn, widthIn, heightIn: h, weightLb: w })
      }
    }
    return rows
  }, [heightIn, weightLb])

  const runSweep = useCallback(async () => {
    if (selectedCarrierIds.length === 0) {
      toast.error('Select at least one carrier in the calculator above')
      return
    }
    const shipFrom = hubAddress(lane.fromId)
    const shipTo = hubAddress(lane.toId)
    if (!shipFrom || !shipTo) {
      toast.error('Could not resolve sample lane hubs — check rate-usa-hubs ids')
      return
    }

    setBusy(true)
    setCells([])
    setProgress({ done: 0, total: grid.length })
    const next: SweepCell[] = []
    let prevTotal: number | null = null

    try {
      for (let i = 0; i < grid.length; i++) {
        const cell = grid[i]!
        const flags = upsParcelSurchargeFlags(cell)
        let total: number | null = null
        let currency: string | null = null
        let carrierName: string | null = null
        let serviceName: string | null = null
        let error: string | null = null

        try {
          const payload = {
            rate_options: { carrier_ids: selectedCarrierIds },
            shipment: buildShipmentBody(shipFrom, shipTo, {
              weightValue: cell.weightLb,
              weightUnit: 'pound',
              length: cell.lengthIn,
              width: cell.widthIn,
              height: cell.heightIn,
              dimUnit: 'inch',
              packageCode: 'package',
              validateAddress: 'no_validation',
            }),
          }
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
            error = typeof err === 'string' ? err : JSON.stringify(err)
          } else {
            const best = cheapestTotal(data)
            if (!best) {
              error = 'No rates returned'
            } else {
              total = best.total
              currency = best.currency
              carrierName = best.carrierName
              serviceName = best.serviceName
            }
          }
        } catch (e) {
          error = e instanceof Error ? e.message : 'Rate request failed'
        }

        const priceJump =
          total != null &&
          prevTotal != null &&
          prevTotal > 0 &&
          total >= prevTotal * 1.4

        next.push({
          ...cell,
          dimIn: flags.dimIn,
          volumeIn3: flags.volumeIn3,
          dimOver130: flags.dimOver130,
          lengthOver96: flags.lengthOver96,
          volumeOver10368: flags.volumeOver10368,
          volumeOver17280: flags.volumeOver17280,
          largePackageLikely: flags.largePackageLikely,
          total,
          currency,
          carrierName,
          serviceName,
          error,
          priceJump,
        })
        if (total != null) prevTotal = total
        setProgress({ done: i + 1, total: grid.length })
        setCells([...next])
      }
      toast.success(`Sweep complete — ${next.length} cartons rated`)
    } finally {
      setBusy(false)
    }
  }, [grid, lane.fromId, lane.toId, selectedCarrierIds])

  const exportCsv = () => {
    if (cells.length === 0) {
      toast.error('Run a sweep first')
      return
    }
    const header = [
      'length_in',
      'width_in',
      'height_in',
      'weight_lb',
      'dim_in',
      'volume_in3',
      'dim_over_130',
      'length_over_96',
      'volume_over_10368',
      'volume_over_17280',
      'large_package_likely',
      'total',
      'currency',
      'carrier',
      'service',
      'price_jump_40pct',
      'error',
    ]
    const lines = [
      header.join(','),
      ...cells.map((c) =>
        [
          c.lengthIn,
          c.widthIn,
          c.heightIn,
          c.weightLb,
          c.dimIn,
          c.volumeIn3,
          c.dimOver130,
          c.lengthOver96,
          c.volumeOver10368,
          c.volumeOver17280,
          c.largePackageLikely,
          c.total?.toFixed(2) ?? '',
          c.currency ?? '',
          c.carrierName ?? '',
          c.serviceName ?? '',
          c.priceJump,
          c.error ?? '',
        ]
          .map(csvCell)
          .join(','),
      ),
    ]
    downloadCsv(lines.join('\n'), `shortboard-rate-cliff-${lane.id}-${Date.now()}.csv`)
  }

  return (
    <Card className={surfaceCard}>
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-base font-semibold tracking-tight">
          Shortboard rate-cliff sweep
        </CardTitle>
        <CardDescription className="text-[14px] leading-relaxed">
          Rates a grid of shortboard cartons on a fixed lane via ShipEngine. Use this to lock Compact /
          Medium pack bands where price jumps (often at 130″ DIM / large-package). Current locked
          bands:{' '}
          {Object.values(SURFBOARD_SHIPPING_PACK_BANDS)
            .map(
              (b) =>
                `${b.label} ${b.lengthIn}×${b.widthIn}×${b.heightIn}`,
            )
            .join(' · ')}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Lane</Label>
            <Select value={laneId} onValueChange={setLaneId}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_LANES.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Height (in)</Label>
            <Select value={heightIn} onValueChange={setHeightIn}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEIGHTS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h}″
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Weight (lb)</Label>
            <Select value={weightLb} onValueChange={setWeightLb}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEIGHTS.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    {w} lb
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void runSweep()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Run sweep ({grid.length} cartons)
          </Button>
          <Button type="button" variant="outline" disabled={cells.length === 0} onClick={exportCsv}>
            Download CSV
          </Button>
          {busy || progress.total > 0 ? (
            <Badge variant="secondary" className="h-9 rounded-xl px-3 font-mono text-xs">
              {progress.done}/{progress.total}
            </Badge>
          ) : null}
        </div>

        {cells.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={shipTh}>L×W×H</TableHead>
                  <TableHead className={shipTh}>DIM</TableHead>
                  <TableHead className={shipTh}>Vol</TableHead>
                  <TableHead className={shipTh}>Flags</TableHead>
                  <TableHead className={cn(shipTh, 'text-right')}>Cheapest</TableHead>
                  <TableHead className={shipTh}>Service</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cells.map((c) => (
                  <TableRow
                    key={`${c.lengthIn}-${c.widthIn}-${c.heightIn}-${c.weightLb}`}
                    className={cn(c.priceJump && 'bg-amber-500/10', c.largePackageLikely && 'bg-rose-500/5')}
                  >
                    <TableCell className="font-mono text-xs tabular-nums">
                      {c.lengthIn}×{c.widthIn}×{c.heightIn}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{c.dimIn}″</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {c.volumeIn3.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {[
                        c.dimOver130 ? 'DIM>130' : null,
                        c.volumeOver10368 ? 'Vol>10k' : null,
                        c.volumeOver17280 ? 'Vol>17k' : null,
                        c.largePackageLikely ? 'LPS' : null,
                        c.priceJump ? 'JUMP' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums font-semibold">
                      {c.error
                        ? '—'
                        : c.total != null
                          ? `$${c.total.toFixed(2)}`
                          : '—'}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                      {c.error ?? (c.carrierName ? `${c.carrierName} · ${c.serviceName}` : '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
