"use client"

import { useEffect, useState } from "react"
import { getSupportMacroOrderAction } from "@/lib/actions/supportMacros"
import type { SupportMacroLinkedOrder } from "@/lib/utils/support-macro-order-vars"

export function useSupportMacroOrder(
  orderId: string | null,
  linkedOrder: SupportMacroLinkedOrder | null,
): { order: SupportMacroLinkedOrder | null; ready: boolean } {
  const [fetched, setFetched] = useState<SupportMacroLinkedOrder | null>(null)
  const [ready, setReady] = useState(!orderId || linkedOrder !== null)

  useEffect(() => {
    if (!orderId) {
      setFetched(null)
      setReady(true)
      return
    }
    if (linkedOrder) {
      setFetched(linkedOrder)
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)
    void getSupportMacroOrderAction({ order_id: orderId }).then((result) => {
      if (cancelled) return
      setFetched("data" in result ? result.data : null)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [orderId, linkedOrder])

  return { order: linkedOrder ?? fetched, ready }
}
