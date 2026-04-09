'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ExternalLink, Loader2, RefreshCw, Ship, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { ShippingRateCalculator } from './rate-calculator'

type ApiSlice = { ok: boolean; status: number; data: unknown }

type OverviewPayload =
  | {
      configured: false
      message?: string
    }
  | {
      configured: true
      carriers: ApiSlice
      warehouses: ApiSlice
      labels: ApiSlice
    }

const ADDRESS_VALIDATE_PLACEHOLDER = `[
  {
    "name": "Example",
    "address_line1": "500 South Buena Vista Street",
    "city_locality": "Burbank",
    "state_province": "CA",
    "postal_code": "91521",
    "country_code": "US"
  }
]`

const CREATE_LABEL_PLACEHOLDER = `{
  "shipment": {
    "carrier_id": "YOUR_CARRIER_ACCOUNT_ID",
    "service_code": "usps_priority_mail",
    "ship_to": { },
    "ship_from": { },
    "packages": [ { "weight": { "value": 16, "unit": "ounce" } } ]
  }
}`

const PURCHASE_RATE_PLACEHOLDER = `{
  "rate_id": "se-xxxxxxxx",
  "label_format": "pdf",
  "label_download_type": "url"
}`

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function carriersList(data: unknown): Record<string, unknown>[] {
  const r = asRecord(data)
  const arr = r?.carriers
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

function warehousesList(data: unknown): Record<string, unknown>[] {
  const r = asRecord(data)
  const arr = r?.warehouses
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

function labelsList(data: unknown): Record<string, unknown>[] {
  const r = asRecord(data)
  const arr = r?.labels
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

function formatCell(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  try {
    return JSON.stringify(v)
  } catch {
    return '…'
  }
}

function JsonPreview({ value }: { value: unknown }) {
  let text: string
  try {
    text = JSON.stringify(value, null, 2)
  } catch {
    text = String(value)
  }
  return (
    <pre className="text-[11px] leading-relaxed bg-black/[0.03] dark:bg-white/[0.04] rounded-2xl border border-border/50 p-4 overflow-x-auto max-h-[min(70vh,520px)] font-mono text-foreground/90 shadow-inner">
      {text}
    </pre>
  )
}

const shipTableShell = 'rounded-2xl border border-border/50 overflow-hidden bg-background/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
const shipTableHead =
  'bg-muted/40 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground h-11'

export function AdminShippingClient() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const initialLoadDoneRef = useRef(false)

  const [addrJson, setAddrJson] = useState(ADDRESS_VALIDATE_PLACEHOLDER)
  const [labelJson, setLabelJson] = useState(CREATE_LABEL_PLACEHOLDER)
  const [purchaseJson, setPurchaseJson] = useState(PURCHASE_RATE_PLACEHOLDER)

  const [addrResult, setAddrResult] = useState<unknown>(null)
  const [labelResult, setLabelResult] = useState<unknown>(null)
  const [purchaseResult, setPurchaseResult] = useState<unknown>(null)

  const [addrBusy, setAddrBusy] = useState(false)
  const [labelBusy, setLabelBusy] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const firstEver = !initialLoadDoneRef.current
    if (firstEver) setLoading(true)
    else if (!opts?.silent) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/shipengine', { credentials: 'include' })
      const body = (await res.json()) as OverviewPayload
      if (!res.ok) {
        toast.error('Could not load ShipEngine overview')
        setOverview(null)
        return
      }
      setOverview(body)
    } catch {
      toast.error('Could not load ShipEngine overview')
      setOverview(null)
    } finally {
      if (firstEver) {
        setLoading(false)
        initialLoadDoneRef.current = true
      } else if (!opts?.silent) {
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function postAction(
    action: 'validate_address' | 'create_label' | 'purchase_rate',
    rawJson: string,
    setBusy: (b: boolean) => void,
    setResult: (v: unknown) => void,
  ) {
    let payload: unknown
    try {
      payload = JSON.parse(rawJson) as unknown
    } catch {
      toast.error('Invalid JSON — fix syntax and try again')
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/shipengine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      })
      const data = (await res.json()) as unknown
      setResult(data)
      const payloadOk = asRecord(data)?.ok === true
      if (!res.ok || !payloadOk) {
        toast.error('ShipEngine returned an error (see response below)')
      } else {
        toast.success('Request completed')
      }
    } catch {
      toast.error('Request failed')
    } finally {
      setBusy(false)
    }
  }

  const configured = overview && 'configured' in overview && overview.configured

  return (
    <div className="mx-auto max-w-5xl w-full space-y-10 pb-12 antialiased selection:bg-foreground/10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Admin · Shipping
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/40 shadow-inner ring-1 ring-border/50">
              <Truck className="h-6 w-6 text-foreground/80" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-tight">
                Shipping
              </h1>
              <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                ShipEngine tools for carriers, rates, and labels.{' '}
                <a
                  href="https://www.shipengine.com/docs/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-foreground/80 underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                >
                  Documentation
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </a>
                <span className="text-muted-foreground/80">
                  {' '}
                  — use sandbox keys when testing; live keys can bill carriers.
                </span>
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0 rounded-full border-border/60 px-5 text-[13px] font-medium shadow-sm transition-all hover:bg-muted/60 hover:shadow"
          onClick={() => void load({ silent: false })}
          disabled={loading || refreshing}
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.5} />}
          <span className="ml-2">Refresh</span>
        </Button>
      </header>

      {loading && !overview ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
          Connecting to ShipEngine…
        </div>
      ) : null}

      {overview && !overview.configured ? (
        <Alert className="rounded-2xl border-border/50 bg-muted/20 shadow-sm">
          <Ship className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
          <AlertTitle className="font-semibold tracking-tight">ShipEngine not configured</AlertTitle>
          <AlertDescription className="text-[15px] leading-relaxed">
            {overview.message ?? 'Set SHIPENGINE_API_KEY on the server (see .env.example).'}
          </AlertDescription>
        </Alert>
      ) : null}

      {configured && overview.configured ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="group relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/15 p-6 shadow-[0_2px_24px_-16px_rgba(0,0,0,0.12)] transition-shadow duration-300 hover:shadow-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Carriers</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
              {overview.carriers.ok ? carriersList(overview.carriers.data).length : '—'}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">Connected accounts</p>
            {!overview.carriers.ok ? (
              <Badge variant="destructive" className="mt-2 rounded-full">
                HTTP {overview.carriers.status}
              </Badge>
            ) : null}
          </div>
          <div className="group relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/15 p-6 shadow-[0_2px_24px_-16px_rgba(0,0,0,0.12)] transition-shadow duration-300 hover:shadow-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Warehouses</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
              {overview.warehouses.ok ? warehousesList(overview.warehouses.data).length : '—'}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">Ship-from locations</p>
            {!overview.warehouses.ok ? (
              <Badge variant="destructive" className="mt-2 rounded-full">
                HTTP {overview.warehouses.status}
              </Badge>
            ) : null}
          </div>
          <div className="group relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/15 p-6 shadow-[0_2px_24px_-16px_rgba(0,0,0,0.12)] transition-shadow duration-300 hover:shadow-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Labels</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
              {overview.labels.ok ? labelsList(overview.labels.data).length : '—'}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">Recent (latest 25)</p>
            {!overview.labels.ok ? (
              <Badge variant="destructive" className="mt-2 rounded-full">
                HTTP {overview.labels.status}
              </Badge>
            ) : null}
          </div>
        </div>
      ) : null}

      {configured && overview.configured ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex h-auto min-h-11 w-full flex-wrap items-center justify-start gap-1 rounded-full border border-border/50 bg-muted/35 p-1.5 backdrop-blur-sm sm:w-fit">
            <TabsTrigger
              value="overview"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:text-foreground/80"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="validate"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:text-foreground/80"
            >
              Validate
            </TabsTrigger>
            <TabsTrigger
              value="rates"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:text-foreground/80"
            >
              Rates
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:text-foreground/80"
            >
              Label
            </TabsTrigger>
            <TabsTrigger
              value="purchase"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:text-foreground/80"
            >
              Purchase
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="page-enter mt-8 space-y-6">
            <Card className="rounded-3xl border-border/50 shadow-[0_2px_32px_-18px_rgba(0,0,0,0.12)]">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-lg font-semibold tracking-tight">Carriers</CardTitle>
                <CardDescription className="text-[15px] leading-relaxed">
                  Use <code className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[12px] font-mono">carrier_id</code> in
                  rate and label calls.{' '}
                  <Link
                    href="https://www.shipengine.com/docs/carriers/setup/"
                    className="font-medium text-foreground/75 underline decoration-border underline-offset-4 hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Setup guide
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto pt-2">
                {overview.carriers.ok ? (
                  <div className={shipTableShell}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className={shipTableHead}>Name</TableHead>
                        <TableHead className={shipTableHead}>Code</TableHead>
                        <TableHead className={shipTableHead}>Carrier ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carriersList(overview.carriers.data).map((c, i) => (
                        <TableRow key={String(c.carrier_id ?? c.carrier_code ?? i)}>
                          <TableCell className="max-w-[200px] truncate">
                            {formatCell(c.friendly_name ?? c.nickname ?? c.description)}
                          </TableCell>
                          <TableCell>{formatCell(c.carrier_code)}</TableCell>
                          <TableCell className="font-mono text-xs">{formatCell(c.carrier_id)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <JsonPreview value={overview.carriers.data} />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/50 shadow-[0_2px_32px_-18px_rgba(0,0,0,0.12)]">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-lg font-semibold tracking-tight">Warehouses</CardTitle>
                <CardDescription className="text-[15px] leading-relaxed">
                  Default ship-from locations in ShipEngine
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto pt-2">
                {overview.warehouses.ok ? (
                  <div className={shipTableShell}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className={shipTableHead}>Name</TableHead>
                        <TableHead className={shipTableHead}>Warehouse ID</TableHead>
                        <TableHead className={shipTableHead}>City</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehousesList(overview.warehouses.data).map((w, i) => {
                        const origin = asRecord(w.origin_address) ?? asRecord(w.address)
                        return (
                          <TableRow key={String(w.warehouse_id ?? w.name ?? i)}>
                            <TableCell>{formatCell(w.name)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatCell(w.warehouse_id)}
                            </TableCell>
                            <TableCell>{formatCell(origin?.city_locality ?? w.city)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <JsonPreview value={overview.warehouses.data} />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/50 shadow-[0_2px_32px_-18px_rgba(0,0,0,0.12)]">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-lg font-semibold tracking-tight">Recent labels</CardTitle>
                <CardDescription className="text-[15px] leading-relaxed">
                  Tracking and downloads when available.{' '}
                  <Link
                    href="https://www.shipengine.com/docs/labels/"
                    className="font-medium text-foreground/75 underline decoration-border underline-offset-4 hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Labels
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto pt-2">
                {overview.labels.ok ? (
                  <div className={shipTableShell}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className={shipTableHead}>Label ID</TableHead>
                        <TableHead className={shipTableHead}>Tracking</TableHead>
                        <TableHead className={shipTableHead}>Status</TableHead>
                        <TableHead className={shipTableHead}>Created</TableHead>
                        <TableHead className={shipTableHead}>Carrier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {labelsList(overview.labels.data).map((row, i) => (
                        <TableRow key={String(row.label_id ?? row.tracking_number ?? i)}>
                          <TableCell className="font-mono text-xs max-w-[140px] truncate">
                            {formatCell(row.label_id)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formatCell(row.tracking_number)}</TableCell>
                          <TableCell>{formatCell(row.status)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatCell(row.created_at)}
                          </TableCell>
                          <TableCell>{formatCell(row.carrier_code)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <JsonPreview value={overview.labels.data} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validate" className="page-enter mt-8 space-y-5">
            <div className="rounded-3xl border border-border/50 bg-muted/10 p-5 shadow-sm sm:p-6">
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Validates one or more addresses (JSON array).{' '}
                <Link
                  href="https://www.shipengine.com/docs/addresses/validation/"
                  className="font-medium text-foreground/80 underline decoration-border underline-offset-4 hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Address validation
                </Link>
              </p>
              <Separator className="my-5 bg-border/60" />
              <Textarea
                value={addrJson}
                onChange={(e) => setAddrJson(e.target.value)}
                className="min-h-[220px] rounded-2xl border-border/60 bg-background/80 font-mono text-[12px] leading-relaxed shadow-inner"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={addrBusy}
                  className="h-11 rounded-full px-6 font-medium shadow-sm"
                  onClick={() =>
                    void postAction('validate_address', addrJson, setAddrBusy, setAddrResult)
                  }
                >
                  {addrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span className={addrBusy ? 'ml-2' : ''}>Run validation</span>
                </Button>
              </div>
            </div>
            {addrResult != null ? <JsonPreview value={addrResult} /> : null}
          </TabsContent>

          <TabsContent value="rates" className="page-enter mt-8">
            <ShippingRateCalculator carriers={carriersList(overview.carriers.data)} />
          </TabsContent>

          <TabsContent value="create" className="page-enter mt-8 space-y-5">
            <div className="rounded-3xl border border-border/50 bg-muted/10 p-5 shadow-sm sm:p-6">
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Purchase a label with a full request body.{' '}
                <Link
                  href="https://www.shipengine.com/docs/labels/create-a-label/"
                  className="font-medium text-foreground/80 underline decoration-border underline-offset-4 hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Create a label
                </Link>
              </p>
              <Separator className="my-5 bg-border/60" />
              <Textarea
                value={labelJson}
                onChange={(e) => setLabelJson(e.target.value)}
                className="min-h-[300px] rounded-2xl border-border/60 bg-background/80 font-mono text-[12px] leading-relaxed shadow-inner"
              />
              <div className="mt-4">
                <Button
                  disabled={labelBusy}
                  className="h-11 rounded-full px-6 font-medium shadow-sm"
                  onClick={() => void postAction('create_label', labelJson, setLabelBusy, setLabelResult)}
                >
                  {labelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span className={labelBusy ? 'ml-2' : ''}>Create label</span>
                </Button>
              </div>
            </div>
            {labelResult != null ? <JsonPreview value={labelResult} /> : null}
          </TabsContent>

          <TabsContent value="purchase" className="page-enter mt-8 space-y-5">
            <div className="rounded-3xl border border-border/50 bg-muted/10 p-5 shadow-sm sm:p-6">
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Buy a label using a <code className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[12px] font-mono">rate_id</code>{' '}
                from Rates. Optional label options go in the JSON body.
              </p>
              <Separator className="my-5 bg-border/60" />
              <Textarea
                value={purchaseJson}
                onChange={(e) => setPurchaseJson(e.target.value)}
                className="min-h-[180px] rounded-2xl border-border/60 bg-background/80 font-mono text-[12px] leading-relaxed shadow-inner"
              />
              <div className="mt-4">
                <Button
                  disabled={purchaseBusy}
                  className="h-11 rounded-full px-6 font-medium shadow-sm"
                  onClick={() =>
                    void postAction('purchase_rate', purchaseJson, setPurchaseBusy, setPurchaseResult)
                  }
                >
                  {purchaseBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span className={purchaseBusy ? 'ml-2' : ''}>Purchase label</span>
                </Button>
              </div>
            </div>
            {purchaseResult != null ? <JsonPreview value={purchaseResult} /> : null}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
