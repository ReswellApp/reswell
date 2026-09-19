"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LiveChatOrderTileButton } from "@/components/features/live-chat/live-chat-order-tile-button"
import { liveChatOrderTileClickMessage } from "@/lib/live-chat/order-tile-intent"
import type { LiveChatVisitorOrderTile } from "@/lib/services/liveChatVisitorOrders"

interface LiveChatOrderTilesProps {
  publicId: string | null
  visitorToken: string | null
  enabled: boolean
  isSignedIn: boolean
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
  sending = false,
  onSelect,
  onAuthRequired,
  onDismiss,
}: LiveChatOrderTilesProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<LiveChatVisitorOrderTile[]>([])

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
    if (!enabled || loading || error) return
    if (orders.length > 0) return
    const timer = window.setTimeout(() => {
      onDismiss?.()
    }, 2_500)
    return () => window.clearTimeout(timer)
  }, [enabled, error, loading, onDismiss, orders.length])

  if (!enabled) return null
  if (!isSignedIn) return null
  if (!loading && !error && orders.length === 0) return null

  return (
    <div className="space-y-3 border-t border-border/40 bg-muted/20 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Which order?</p>
          <p className="text-[11px] text-muted-foreground">Tap one and I&apos;ll look that one up.</p>
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
          Loading your orders…
        </div>
      ) : null}

      {!loading && orders.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2">
          {orders.map((order) => (
            <li key={order.orderId}>
              <LiveChatOrderTileButton
                orderNum={order.orderNum}
                title={order.title}
                imageUrl={order.imageUrl}
                disabled={sending}
                onClick={() => onSelect(liveChatOrderTileClickMessage(order.orderNum))}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
