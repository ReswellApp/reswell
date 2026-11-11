"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { shipEngineDisputeLinkForShipment } from "@/lib/shipping/shipengine-dispute-link"
import { formatAdjustmentUsd } from "@/lib/shipping/adjustment-fee"
import { cn } from "@/lib/utils"

type PacketField = {
  id: string
  label: string
  value: string
  hint?: string
}

type PacketPayload = {
  adjustmentId: string
  amountUsd: number
  trackingNumber: string | null
  carrier: string
  hasSellerDispute: boolean
  packet: {
    formUrl: string
    formLabel: string
    formHint: string
    filingSteps: string[]
    narrative: string
    fields: PacketField[]
    fullClipboard: string
  }
}

interface AdminOrderShipEngineDisputeLinkProps {
  orderId?: string
  trackingCarrier: string | null
  trackingNumber: string | null
  className?: string
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function CopyField({ field }: { field: PacketField }) {
  const [copied, setCopied] = useState(false)
  const multiline = field.value.includes("\n") || field.value.length > 80

  return (
    <div className="space-y-1.5 rounded-md border border-border/60 bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{field.label}</p>
          {field.hint ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">{field.hint}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2"
          onClick={() => {
            void (async () => {
              const ok = await copyText(field.value)
              if (!ok) {
                toast.error("Could not copy")
                return
              }
              setCopied(true)
              toast.success(`Copied ${field.label}`)
              window.setTimeout(() => setCopied(false), 1500)
            })()
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copy
        </Button>
      </div>
      {multiline ? (
        <Textarea readOnly value={field.value} className="min-h-28 font-mono text-xs" />
      ) : (
        <p className="break-all font-mono text-xs text-foreground">{field.value || "—"}</p>
      )}
    </div>
  )
}

export function AdminOrderShipEngineDisputeLink({
  orderId,
  trackingCarrier,
  trackingNumber,
  className,
}: AdminOrderShipEngineDisputeLinkProps) {
  const fallbackLink = shipEngineDisputeLinkForShipment({ trackingCarrier, trackingNumber })
  const tracking = trackingNumber?.trim() || null
  const [rows, setRows] = useState<PacketPayload[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(orderId))
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipengine-dispute-packet`, {
        credentials: "include",
      })
      const body = (await res.json()) as { data?: PacketPayload[]; error?: string }
      if (!res.ok) throw new Error(body.error || "Could not build dispute packet")
      const next = body.data ?? []
      setRows(next)
      setSelectedId((current) => {
        if (current && next.some((row) => row.adjustmentId === current)) return current
        return next[0]?.adjustmentId ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build dispute packet")
      setRows([])
      setSelectedId(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const selected = rows.find((row) => row.adjustmentId === selectedId) ?? rows[0] ?? null
  const formUrl = selected?.packet.formUrl ?? fallbackLink.href
  const formLabel = selected?.packet.formLabel ?? fallbackLink.label
  const formHint = selected?.packet.formHint ?? fallbackLink.hint

  return (
    <div
      id="shipping-dispute"
      className={cn("space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Shipping dispute
          </p>
          <p className="mt-1 text-sm text-foreground">
            Prefill helper for the ShipEngine / Stamps form — copy fields, then paste into the survey.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {orderId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-background"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Refresh packet
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-background" asChild>
            <a href={formUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {formLabel}
            </a>
          </Button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{formHint}</p>
      {tracking ? <p className="break-all font-mono text-xs text-foreground">{tracking}</p> : null}

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Building dispute packet…
        </p>
      ) : null}

      {error ? <p className="text-xs text-rose-700 dark:text-rose-400">{error}</p> : null}

      {rows.length > 1 ? (
        <label className="block text-xs font-medium text-foreground">
          Adjustment
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            value={selected?.adjustmentId ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {rows.map((row) => (
              <option key={row.adjustmentId} value={row.adjustmentId}>
                {row.carrier.toUpperCase()} · {formatAdjustmentUsd(row.amountUsd)}
                {row.trackingNumber ? ` · ${row.trackingNumber}` : ""}
                {row.hasSellerDispute ? " · seller dispute" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selected ? (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
            {selected.packet.filingSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void (async () => {
                  const ok = await copyText(selected.packet.fullClipboard)
                  if (!ok) {
                    toast.error("Could not copy packet")
                    return
                  }
                  toast.success("Copied full dispute packet")
                })()
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy full packet
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-background"
              onClick={() => {
                void (async () => {
                  const ok = await copyText(selected.packet.narrative)
                  if (!ok) {
                    toast.error("Could not copy narrative")
                    return
                  }
                  toast.success("Copied dispute narrative")
                })()
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy narrative
            </Button>
          </div>

          <div className="space-y-2">
            {selected.packet.fields.map((field) => (
              <CopyField key={field.id} field={field} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
