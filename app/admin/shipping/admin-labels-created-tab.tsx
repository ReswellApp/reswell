"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink, Loader2, MessageSquare, RefreshCw, Search, Upload } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"

type LabelsCreatedRow = {
  id: string
  order_id: string
  created_by: string
  source: string
  label_pdf_url: string | null
  label_storage_path: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  shipengine_rate_id: string | null
  created_at: string
  orderDisplayNum: string
  buyer: { display_name: string | null; email: string | null }
  seller: { display_name: string | null; email: string | null }
}

const ORDER_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function extractOrderIdFromPaste(raw: string): string | null {
  const t = raw.trim()
  const m = t.match(ORDER_UUID_RE)
  return m ? m[0].toLowerCase() : null
}

function sourceLabel(s: string): string {
  if (s === "shipengine_checkout_lane") return "ShipEngine (checkout)"
  if (s === "manual_label_upload") return "Manual PDF"
  if (s === "manual_tracking_buyer") return "Manual tracking"
  return s
}

function extractShipEngineId(raw: string): string | null {
  const t = raw.trim()
  const m = t.match(/se-[a-zA-Z0-9_-]+/)
  return m ? m[0] : null
}

type ShipengineLabelLookupData = {
  label_id: string
  shipment_id: string | null
  tracking_number: string | null
  status: string | null
  voided: boolean
  carrier_code: string | null
  downloads: {
    href: string | null
    pdf: string | null
    png: string | null
    zpl: string | null
  }
  listCount: number | null
}

export function AdminLabelsCreatedTab() {
  const [rows, setRows] = useState<LabelsCreatedRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [uploadOrderRaw, setUploadOrderRaw] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)

  const [trackOrderRaw, setTrackOrderRaw] = useState("")
  const [trackNumber, setTrackNumber] = useState("")
  const [trackCarrier, setTrackCarrier] = useState("")
  const [trackBusy, setTrackBusy] = useState(false)

  const [seLookupMode, setSeLookupMode] = useState<"shipment" | "label">("shipment")
  const [seLookupRaw, setSeLookupRaw] = useState("")
  const [seLookupBusy, setSeLookupBusy] = useState(false)
  const [seLookupResult, setSeLookupResult] = useState<ShipengineLabelLookupData | null>(null)
  const [seSendOrderRaw, setSeSendOrderRaw] = useState("")
  const [seSendBusy, setSeSendBusy] = useState(false)

  const [voidOrderRaw, setVoidOrderRaw] = useState("")
  const [voidLabelRaw, setVoidLabelRaw] = useState("")
  const [voidBusy, setVoidBusy] = useState(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch("/api/admin/shipping/labels-created?limit=50", {
        credentials: "include",
      })
      const body = (await res.json()) as { data?: LabelsCreatedRow[]; total?: number; error?: string }
      if (!res.ok || !body.data) {
        toast.error(body.error ?? "Could not load labels")
        setRows([])
        setTotal(0)
        return
      }
      setRows(body.data)
      setTotal(typeof body.total === "number" ? body.total : body.data.length)
    } catch {
      toast.error("Could not load labels")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const uploadOrderId = extractOrderIdFromPaste(uploadOrderRaw)

  const seLookupId = extractShipEngineId(seLookupRaw)
  const seSendOrderId = extractOrderIdFromPaste(seSendOrderRaw)

  const voidOrderId = extractOrderIdFromPaste(voidOrderRaw)
  const voidLabelId = extractShipEngineId(voidLabelRaw)

  const fetchShipengineLabel = async () => {
    if (!seLookupId) {
      toast.error("Paste a ShipEngine id (e.g. se-294634082).")
      return
    }
    setSeLookupBusy(true)
    setSeLookupResult(null)
    try {
      const q =
        seLookupMode === "shipment"
          ? `shipment_id=${encodeURIComponent(seLookupId)}`
          : `label_id=${encodeURIComponent(seLookupId)}`
      const res = await fetch(`/api/admin/shipping/shipengine-label?${q}`, {
        credentials: "include",
      })
      const body = (await res.json()) as { data?: ShipengineLabelLookupData; error?: string }
      if (!res.ok || !body.data) {
        toast.error(body.error?.trim() || "ShipEngine lookup failed", { duration: 12_000 })
        return
      }
      setSeLookupResult(body.data)
      const hasUrl = Object.values(body.data.downloads).some((u) => u != null && u.length > 0)
      if (!hasUrl) {
        toast.message("Label found", {
          description:
            body.data.status === "processing" || body.data.status === "pending"
              ? "No download URLs yet — wait and fetch again."
              : "No download URLs in this response. Try again or open the label in ShipEngine.",
        })
      } else {
        toast.success("Label URLs loaded — open links before they expire.")
      }
    } catch {
      toast.error("ShipEngine lookup failed")
    } finally {
      setSeLookupBusy(false)
    }
  }

  const sendShipenginePdfToSeller = async () => {
    if (!seLookupId) {
      toast.error("Fetch a label first.")
      return
    }
    const pdf = seLookupResult?.downloads.pdf?.trim()
    if (!pdf) {
      toast.error("No PDF URL yet — wait until ShipEngine returns a PDF link, then fetch again.")
      return
    }
    if (seLookupResult?.voided) {
      toast.error("This label is voided.")
      return
    }
    setSeSendBusy(true)
    try {
      const body: Record<string, string> =
        seLookupMode === "shipment"
          ? { shipment_id: seLookupId }
          : { label_id: seLookupId }
      if (seSendOrderId) body.order_id = seSendOrderId
      const res = await fetch("/api/admin/shipping/shipengine-label/send-to-seller", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const parsed = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !parsed.success) {
        toast.error(parsed.error?.trim() || "Could not send label", { duration: 14_000 })
        return
      }
      toast.success("PDF stored and posted to the seller’s buyer thread.")
      setSeSendOrderRaw("")
      void load({ silent: true })
    } catch {
      toast.error("Could not send label")
    } finally {
      setSeSendBusy(false)
    }
  }

  const submitVoidShipEngineLabel = async () => {
    if (!voidOrderId) {
      toast.error("Paste the Reswell order UUID.")
      return
    }
    const msg =
      "Void this ShipEngine label? The carrier may credit your ShipEngine balance if the label is unused. This cannot be undone."
    if (typeof window !== "undefined" && !window.confirm(msg)) return

    setVoidBusy(true)
    try {
      const body: { order_id: string; label_id?: string } = { order_id: voidOrderId }
      if (voidLabelId) body.label_id = voidLabelId
      const res = await fetch("/api/admin/shipping/shipengine-label/void", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const parsed = (await res.json()) as {
        data?: { approved: boolean; message: string; clearedOrderTracking: boolean; labelId: string }
        error?: string
      }
      if (!res.ok || !parsed.data) {
        toast.error(parsed.error?.trim() || "Could not void label", { duration: 14_000 })
        return
      }
      toast.success(
        parsed.data.approved
          ? `Void approved — ${parsed.data.message}`
          : `Carrier response: ${parsed.data.message}`,
        { duration: 12_000 },
      )
      if (parsed.data.clearedOrderTracking) {
        toast.message("Order tracking cleared on Reswell to match the voided label.")
      }
      void load({ silent: true })
      setVoidLabelRaw("")
    } catch {
      toast.error("Void request failed")
    } finally {
      setVoidBusy(false)
    }
  }

  const submitUpload = async () => {
    if (!uploadOrderId) {
      toast.error("Paste a valid order UUID or admin order URL.")
      return
    }
    if (!uploadFile || uploadFile.type !== "application/pdf") {
      toast.error("Choose a PDF file.")
      return
    }
    setUploadBusy(true)
    try {
      const form = new FormData()
      form.set("order_id", uploadOrderId)
      form.set("file", uploadFile)
      const res = await fetch("/api/admin/shipping/labels-created/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const body = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !body.success) {
        toast.error(body.error?.trim() || "Upload failed")
        return
      }
      toast.success("Label PDF sent to the seller’s sale thread.")
      setUploadFile(null)
      setUploadOrderRaw("")
      void load({ silent: true })
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploadBusy(false)
    }
  }

  const trackOrderId = extractOrderIdFromPaste(trackOrderRaw)

  const submitTracking = async () => {
    if (!trackOrderId) {
      toast.error("Paste a valid order UUID or admin order URL.")
      return
    }
    const tn = trackNumber.trim()
    if (tn.length < 3) {
      toast.error("Enter a tracking number (at least 3 characters).")
      return
    }
    setTrackBusy(true)
    try {
      const res = await fetch("/api/admin/shipping/labels-created/tracking", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: trackOrderId,
          tracking_number: tn,
          tracking_carrier: trackCarrier.trim() || undefined,
        }),
      })
      const body = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !body.success) {
        toast.error(body.error?.trim() || "Could not save tracking")
        return
      }
      toast.success("Tracking saved on the order for the buyer.")
      setTrackNumber("")
      setTrackCarrier("")
      setTrackOrderRaw("")
      void load({ silent: true })
    } catch {
      toast.error("Could not save tracking")
    } finally {
      setTrackBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] leading-relaxed text-muted-foreground max-w-2xl">
          Reswell-purchased and manually uploaded labels registry. Use upload or tracking only when the main
          flow fails — both attach to the order and notify the seller / buyer as appropriate.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full shrink-0"
          onClick={() => void load({ silent: true })}
          disabled={loading || refreshing}
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <Card className="rounded-3xl border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Fetch label from ShipEngine</CardTitle>
          <CardDescription>
            Retrieves PDF, PNG, and ZPL download links from the same API key used for purchasing. Paste a
            shipment id from the ShipEngine dashboard, or a label id if you have it. Links are often
            short-lived — download or open them promptly. Use Send PDF to seller to download server-side,
            store privately, and post the same thread message as manual upload (tracking must match an
            order unless you paste the order UUID below).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={seLookupMode}
            onValueChange={(v) => {
              setSeLookupMode(v as "shipment" | "label")
              setSeLookupResult(null)
            }}
            className="flex flex-wrap gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="shipment" id="se-mode-shipment" />
              <Label htmlFor="se-mode-shipment" className="font-normal cursor-pointer">
                Shipment ID <span className="text-muted-foreground">(GET /labels?shipment_id=…)</span>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="label" id="se-mode-label" />
              <Label htmlFor="se-mode-label" className="font-normal cursor-pointer">
                Label ID <span className="text-muted-foreground">(GET /labels/…)</span>
              </Label>
            </div>
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="se-lookup-id">ShipEngine id</Label>
            <Input
              id="se-lookup-id"
              placeholder="se-294634082"
              value={seLookupRaw}
              onChange={(e) => {
                setSeLookupRaw(e.target.value)
                setSeLookupResult(null)
              }}
              className="rounded-xl font-mono text-sm max-w-xl"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="rounded-full gap-2"
            onClick={() => void fetchShipengineLabel()}
            disabled={seLookupBusy || !seLookupId}
          >
            {seLookupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Fetch from ShipEngine
          </Button>

          {seLookupResult ? (
            <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">Label:</span>{" "}
                  <span className="font-mono text-xs">{seLookupResult.label_id}</span>
                </span>
                {seLookupResult.shipment_id ? (
                  <span>
                    <span className="font-medium text-foreground">Shipment:</span>{" "}
                    <span className="font-mono text-xs">{seLookupResult.shipment_id}</span>
                  </span>
                ) : null}
                {seLookupResult.listCount != null ? (
                  <span>
                    <span className="font-medium text-foreground">Matches:</span> {seLookupResult.listCount}{" "}
                    (using first)
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {seLookupResult.tracking_number ? (
                  <span>
                    <span className="text-muted-foreground">Tracking</span>{" "}
                    <span className="font-mono text-xs">{seLookupResult.tracking_number}</span>
                  </span>
                ) : null}
                {seLookupResult.carrier_code ? (
                  <span>
                    <span className="text-muted-foreground">Carrier</span> {seLookupResult.carrier_code}
                  </span>
                ) : null}
                {seLookupResult.status ? (
                  <span>
                    <span className="text-muted-foreground">Status</span> {seLookupResult.status}
                  </span>
                ) : null}
                {seLookupResult.voided ? (
                  <span className="text-destructive font-medium">Voided — do not use for shipping.</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 pt-1 items-center">
                {(
                  [
                    ["PDF", seLookupResult.downloads.pdf],
                    ["PNG", seLookupResult.downloads.png],
                    ["ZPL", seLookupResult.downloads.zpl],
                    ["Combined", seLookupResult.downloads.href],
                  ] as const
                ).map(([label, url]) =>
                  url ? (
                    <Button key={label} variant="outline" size="sm" className="rounded-full gap-1.5 h-9" asChild>
                      <a href={url} target="_blank" rel="noreferrer">
                        Open {label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null,
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full gap-1.5 h-9"
                  onClick={() => void sendShipenginePdfToSeller()}
                  disabled={
                    seSendBusy ||
                    !seLookupResult.downloads.pdf ||
                    seLookupResult.voided ||
                    !seLookupId
                  }
                >
                  {seSendBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                  Send PDF to seller
                </Button>
              </div>
              <div className="space-y-1 pt-1">
                <Label htmlFor="se-send-order" className="text-xs font-normal text-muted-foreground">
                  Order UUID (optional — only if tracking doesn’t match a pending surfboard order yet)
                </Label>
                <Input
                  id="se-send-order"
                  placeholder="Paste order id or /admin/orders/… URL"
                  value={seSendOrderRaw}
                  onChange={(e) => setSeSendOrderRaw(e.target.value)}
                  className="rounded-xl font-mono text-sm max-w-xl"
                />
              </div>
              {!Object.values(seLookupResult.downloads).some((u) => u) ? (
                <p className="text-xs text-muted-foreground">
                  No URLs in this response. If status is still processing, wait and fetch again.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/50 border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base">Void label / refund (ShipEngine)</CardTitle>
          <CardDescription>
            Calls ShipEngine{" "}
            <span className="font-mono text-xs">PUT /v1/labels/&#123;label_id&#125;/void</span>. Unused labels
            may be refunded to your ShipEngine balance per carrier rules. Requires admin. If you omit label id,
            the newest non-voided label for the order&apos;s saved tracking is voided.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="void-order">Order UUID</Label>
            <Input
              id="void-order"
              placeholder="Paste order id or /admin/orders/… URL"
              value={voidOrderRaw}
              onChange={(e) => setVoidOrderRaw(e.target.value)}
              className="rounded-xl font-mono text-sm max-w-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="void-label" className="font-normal text-muted-foreground">
              ShipEngine label id (optional — leave blank to use order tracking)
            </Label>
            <Input
              id="void-label"
              placeholder="se-…"
              value={voidLabelRaw}
              onChange={(e) => setVoidLabelRaw(e.target.value)}
              className="rounded-xl font-mono text-sm max-w-xl"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            className="rounded-full gap-2"
            onClick={() => void submitVoidShipEngineLabel()}
            disabled={voidBusy || !voidOrderId}
          >
            {voidBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Void label &amp; request refund
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Upload label PDF</CardTitle>
            <CardDescription>
              Stored privately and posted to the seller’s messages for this order. Does not set order status to
              shipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fallback-upload-order">Order</Label>
              <Input
                id="fallback-upload-order"
                placeholder="Order UUID or /admin/orders/… URL"
                value={uploadOrderRaw}
                onChange={(e) => setUploadOrderRaw(e.target.value)}
                className="rounded-xl font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallback-upload-file">PDF</Label>
              <Input
                id="fallback-upload-file"
                type="file"
                accept="application/pdf"
                className="cursor-pointer rounded-xl text-sm"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              type="button"
              className="rounded-full gap-2"
              onClick={() => void submitUpload()}
              disabled={uploadBusy || !uploadOrderId || !uploadFile}
            >
              {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload to seller
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Add tracking for buyer</CardTitle>
            <CardDescription>
              Fallback when no PDF: saves tracking on the order so the buyer sees it. Optional carrier name
              (e.g. UPS).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fallback-track-order">Order</Label>
              <Input
                id="fallback-track-order"
                placeholder="Order UUID or /admin/orders/… URL"
                value={trackOrderRaw}
                onChange={(e) => setTrackOrderRaw(e.target.value)}
                className="rounded-xl font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallback-track-num">Tracking number</Label>
              <Input
                id="fallback-track-num"
                placeholder="1Z…"
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                className="rounded-xl font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallback-track-carrier">Carrier (optional)</Label>
              <Input
                id="fallback-track-carrier"
                placeholder="UPS, FedEx, USPS…"
                value={trackCarrier}
                onChange={(e) => setTrackCarrier(e.target.value)}
                className="rounded-xl text-sm"
              />
            </div>
            <Button
              type="button"
              className="rounded-full"
              onClick={() => void submitTracking()}
              disabled={trackBusy || !trackOrderId || trackNumber.trim().length < 3}
            >
              {trackBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save tracking
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Labels created</CardTitle>
          <CardDescription>
            {total > 0 ? (
              <>
                Showing {rows.length} of {total} — newest first.
              </>
            ) : (
              "No rows yet."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">Buy a label from the Order label tab to see it here.</p>
          ) : (
            <div className="rounded-2xl border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                      When
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                      Order
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                      Buyer
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                      Seller
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                      Source
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                      Tracking
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">#{r.orderDisplayNum}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm">
                        {r.buyer.display_name?.trim() || r.buyer.email || "—"}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm">
                        {r.seller.display_name?.trim() || r.seller.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{sourceLabel(r.source)}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[160px] truncate">
                        {r.tracking_number?.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="rounded-full h-8 px-2 gap-1" asChild>
                          <Link href={`/admin/orders/${r.order_id}`}>
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
