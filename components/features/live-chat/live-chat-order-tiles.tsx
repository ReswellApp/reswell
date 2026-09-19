"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LiveChatOrderRoleAsk } from "@/components/features/live-chat/live-chat-order-role-ask"
import { LiveChatOrderTileButton } from "@/components/features/live-chat/live-chat-order-tile-button"
import {
  liveChatOrderLookupRole,
  liveChatOrderTileClickMessage,
  resolveLiveChatOrderTileRole,
  type LiveChatOrderRole,
} from "@/lib/live-chat/order-tile-intent"

import type { LiveChatVisitorOrderTile } from "@/lib/services/liveChatVisitorOrders"

interface LiveChatOrderTilesProps {
  publicId: string | null
  visitorToken: string | null
  enabled: boolean
  isSignedIn: boolean
  lookupText?: string

  sending?: boolean
  onSelect: (content: string) => void
  onAuthRequired?: () => void
  onDismiss?: () => void
}

export function LiveChatOrderTiles({
  publicId,
  visitorToken,
  enabled,
  isSignedIn,
  lookupText = "",

  sending = false,
  onSelect,
  onAuthRequired,
  onDismiss,
}: LiveChatOrderTilesProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<LiveChatVisitorOrderTile[]>([])
  const [pickedRole, setPickedRole] = useState<LiveChatOrderRole | null>(null)


  const load = useCallback(async () => {
    if (!publicId || !enabled) return
    if (!isSignedIn) {
      onAuthRequired?.()
      onDismiss?.()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = visitorToken ? `?visitor_token=${encodeURIComponent(visitorToken)}` : ""
      const res = await fetch(
        `/api/live-chat/session/${encodeURIComponent(publicId)}/orders${qs}`,
      )
      const json = (await res.json()) as {
        data?: { orders: LiveChatVisitorOrderTile[]; authRequired: boolean }
        error?: string
      }
      if (!res.ok || !json.data) {
        if (res.status === 401) onAuthRequired?.()
        setError(json.error ?? "Could not load your orders.")
        return
      }
      if (json.data.authRequired) {
        onAuthRequired?.()
        onDismiss?.()
        return
      }
      setOrders(json.data.orders)
    } catch {
      setError("Could not load your orders.")
    } finally {
      setLoading(false)
    }
  }, [enabled, isSignedIn, onAuthRequired, onDismiss, publicId, visitorToken])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPickedRole(null)
  }, [lookupText])

  useEffect(() => {

    if (!enabled || loading || error) return
    if (orders.length > 0) return
    const timer = window.setTimeout(() => {
      onDismiss?.()
    }, 2_500)
    return () => window.clearTimeout(timer)
  }, [enabled, error, loading, onDismiss, orders.length])

  const inferredRole = useMemo(() => liveChatOrderLookupRole(lookupText), [lookupText])
  const autoRole = useMemo(
    () => resolveLiveChatOrderTileRole({ orders, inferredRole }),
    [inferredRole, orders],
  )
  const role = pickedRole ?? autoRole
  const canChangeRole = orders.some((order) => order.role === "buyer") &&
    orders.some((order) => order.role === "seller")
  const visibleOrders = role ? orders.filter((order) => order.role === role) : []


  if (!enabled) return null
  if (!isSignedIn) return null
  if (!loading && !error && orders.length === 0) return null

  const heading = !role
    ? "Bought or sold?"
    : role === "buyer"
      ? "Which purchase?"
      : "Which sale?"
  const subtitle = !role
    ? "Was it something you bought or sold?"
    : "Tap one and I&apos;ll look that one up."

  return (
    <div className="flex min-h-0 max-h-[min(20rem,48%)] flex-col overflow-hidden border-t border-border/40 bg-muted/20 px-3 py-2">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{heading}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>

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

      {error ? <p className="mt-2 shrink-0 text-xs text-destructive">{error}</p> : null}

      {loading ? (
        <div className="mt-2 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">

          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading your orders…
        </div>
      ) : null}

      {!loading && !role ? <LiveChatOrderRoleAsk onPick={setPickedRole} /> : null}

      {!loading && role ? (
        <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
          {canChangeRole ? (
            <button
              type="button"
              className="mb-1.5 shrink-0 self-start text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setPickedRole(null)}
            >
              ← Bought or sold?
            </button>
          ) : null}
          {visibleOrders.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-center text-[11px] text-muted-foreground">
              No matching {role === "buyer" ? "purchases" : "sales"} to pick.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {visibleOrders.map((order) => (
                <li key={order.orderId}>
                  <LiveChatOrderTileButton
                    orderNum={order.orderNum}
                    title={order.title}
                    imageUrl={order.imageUrl}
                    disabled={sending}
                    onClick={() => onSelect(liveChatOrderTileClickMessage(order.orderNum, role))}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

      ) : null}
    </div>
  )
}
