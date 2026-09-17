"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { Loader2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { LiveChatLabelEligibleOrder } from "@/lib/db/liveChatLabelEligibleOrders"
import type { LiveChatShipFromAddressOption } from "@/lib/services/liveChatShipFromLabelUpdate"
import type { LiveChatLabelUpdateReason } from "@/lib/validations/liveChatLabelUpdate"

type Step = "orders" | "why" | "address" | "confirm" | "done"

const WHY_OPTIONS: Array<{ id: LiveChatLabelUpdateReason; label: string }> = [
  { id: "wrong_from_address", label: "Wrong ship-from address on the label" },
  { id: "moved", label: "I need to ship from a different address" },
  { id: "other", label: "Something else" },
]

interface LiveChatLabelUpdatePanelProps {
  publicId: string | null
  visitorToken: string | null
  enabled: boolean
  isSignedIn: boolean
  onAuthRequired?: () => void
  onDismiss?: () => void
}

export function LiveChatLabelUpdatePanel({
  publicId,
  visitorToken,
  enabled,
  isSignedIn,
  onAuthRequired,
  onDismiss,
}: LiveChatLabelUpdatePanelProps) {
  const [step, setStep] = useState<Step>("orders")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<LiveChatLabelEligibleOrder[]>([])
  const [addresses, setAddresses] = useState<LiveChatShipFromAddressOption[]>([])
  const [selectedOrder, setSelectedOrder] = useState<LiveChatLabelEligibleOrder | null>(null)
  const [reason, setReason] = useState<LiveChatLabelUpdateReason | null>(null)
  const [reasonNote, setReasonNote] = useState("")
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!publicId || !enabled) return
    if (!isSignedIn) {
      setError("Sign in to update a shipping label for your sale.")
      onAuthRequired?.()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = visitorToken
        ? `?visitor_token=${encodeURIComponent(visitorToken)}`
        : ""
      const res = await fetch(
        `/api/live-chat/session/${encodeURIComponent(publicId)}/label-update${qs}`,
      )
      const json = (await res.json()) as {
        data?: {
          orders: LiveChatLabelEligibleOrder[]
          addresses: LiveChatShipFromAddressOption[]
          authRequired: boolean
        }
        error?: string
      }
      if (!res.ok || !json.data) {
        if (res.status === 401) onAuthRequired?.()
        setError(json.error ?? "Could not load your open sales.")
        return
      }
      if (json.data.authRequired) {
        setError("Sign in to update a shipping label for your sale.")
        onAuthRequired?.()
        return
      }
      setOrders(json.data.orders)
      setAddresses(json.data.addresses)
      const defaultAddress =
        json.data.addresses.find((row) => row.isDefault) ?? json.data.addresses[0] ?? null
      setSelectedAddressId(defaultAddress?.id ?? null)
    } catch {
      setError("Could not load your open sales.")
    } finally {
      setLoading(false)
    }
  }, [enabled, isSignedIn, onAuthRequired, publicId, visitorToken])

  useEffect(() => {
    void load()
  }, [load])

  // Empty eligible list: don't leave the chat stuck in the label flow.
  useEffect(() => {
    if (!enabled || loading || error) return
    if (step !== "orders") return
    if (orders.length > 0) return
    const timer = window.setTimeout(() => {
      onDismiss?.()
    }, 2_500)
    return () => window.clearTimeout(timer)
  }, [enabled, error, loading, onDismiss, orders.length, step])

  async function confirmUpdate() {
    if (!publicId || !selectedOrder || !reason || !selectedAddressId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/live-chat/session/${encodeURIComponent(publicId)}/label-update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitor_token: visitorToken || undefined,
            order_id: selectedOrder.orderId,
            ship_from_address_id: selectedAddressId,
            reason,
            reason_note: reasonNote.trim() || undefined,
          }),
        },
      )
      const json = (await res.json()) as {
        data?: { message: string }
        error?: string
        code?: string
      }
      if (!res.ok || !json.data) {
        if (json.code === "auth_required") onAuthRequired?.()
        setError(json.error ?? "Could not update that label.")
        return
      }
      setDoneMessage(json.data.message)
      setStep("done")
    } catch {
      setError("Could not update that label.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!enabled) return null

  return (
    <div className="space-y-3 border-t border-border/40 bg-muted/20 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Update ship-from address</p>
          <p className="text-[11px] text-muted-foreground">
            Only sales waiting for carrier drop-off. Ship-to stays the same.
          </p>
        </div>
        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={onDismiss}
          >
            Close
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading your open sales…
        </div>
      ) : null}

      {!loading && step === "orders" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Which sale needs an updated ship-from address on the label?
          </p>
          {orders.length === 0 ? (
            <div className="space-y-2">
              <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
                No open sales with a label waiting for drop-off — this update isn&apos;t available
                right now.
              </p>
              {onDismiss ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 w-full rounded-full text-xs"
                  onClick={onDismiss}
                >
                  Ask about something else
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {orders.map((order) => (
                <li key={order.orderId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(order)
                      setStep("why")
                    }}
                    className={cn(
                      "w-full overflow-hidden rounded-xl border border-border/60 bg-background text-left shadow-sm",
                      "transition-colors hover:border-listingHeart/40 hover:bg-muted/40",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      {order.imageUrl ? (
                        <Image
                          src={order.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="160px"
                          unoptimized={listingImageShouldBypassOptimization(order.imageUrl)}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5 p-2">
                      <p className="truncate text-[11px] font-semibold text-foreground">
                        #{order.orderNum}
                      </p>
                      <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                        {order.title}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!loading && step === "why" && selectedOrder ? (
        <div className="space-y-2">
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setStep("orders")}
          >
            ← {selectedOrder.orderNum}
          </button>
          <p className="text-xs text-muted-foreground">Why do you need the label updated?</p>
          <div className="space-y-1.5">
            {WHY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setReason(option.id)
                  setStep("address")
                }}
                className={cn(
                  "w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-left text-xs",
                  "hover:border-listingHeart/40 hover:bg-muted/40",
                  reason === option.id && "border-listingHeart/50 bg-listingHeart/5",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && step === "address" && selectedOrder ? (
        <div className="space-y-2">
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setStep("why")}
          >
            ← Why
          </button>
          <p className="text-xs text-muted-foreground">
            Pick the ship-from address for sale #{selectedOrder.orderNum}.
          </p>
          {reason === "other" ? (
            <textarea
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Brief note (optional)"
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs outline-none focus:border-listingHeart/40"
            />
          ) : null}
          {addresses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
              Add a ship-from address in your profile, then come back here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => {
                    setSelectedAddressId(address.id)
                    setStep("confirm")
                  }}
                  className={cn(
                    "w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-left",
                    "hover:border-listingHeart/40 hover:bg-muted/40",
                    selectedAddressId === address.id && "border-listingHeart/50 bg-listingHeart/5",
                  )}
                >
                  <p className="text-xs font-semibold text-foreground">
                    {address.label}
                    {address.isDefault ? (
                      <span className="ml-1 font-normal text-muted-foreground">(default)</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{address.oneLine}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!loading && step === "confirm" && selectedOrder && selectedAddressId && reason ? (
        <div className="space-y-2">
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setStep("address")}
          >
            ← Address
          </button>
          <div className="rounded-xl border border-border/60 bg-background px-3 py-2.5 text-xs">
            <p className="font-semibold text-foreground">Confirm reprint</p>
            <p className="mt-1 text-muted-foreground">
              Sale #{selectedOrder.orderNum}. We&apos;ll void the current unscanned label and print a
              new one from your selected ship-from address. Buyer address stays the same.
            </p>
          </div>
          <Button
            type="button"
            className="h-8 w-full rounded-full text-xs"
            disabled={submitting}
            onClick={() => void confirmUpdate()}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              "Update ship-from & reprint label"
            )}
          </Button>
        </div>
      ) : null}

      {!loading && step === "done" && doneMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-xs text-foreground">
          {doneMessage}
        </div>
      ) : null}
    </div>
  )
}
