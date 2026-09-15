"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  getSupportCaseCustomerContextAction,
  linkSupportCaseOrderAction,
  listSupportCaseCustomerOrdersAction,
  listSupportCaseCustomerTicketsAction,
} from "@/lib/actions/supportCaseCustomerContext"
import type {
  SupportCaseCustomerContext,
  SupportCaseCustomerOrder,
} from "@/lib/services/supportCaseCustomerContext"
import { shouldApplyCustomerPanelPage } from "@/lib/admin/case-customer-panel"
import type { OrderRoleFilter } from "@/components/features/admin/case-customer-order-browser"

export function useCaseCustomerPanel({
  caseId,
  linkedOrderId,
  initialContext,
  onOrderLinked,
}: {
  caseId: string
  linkedOrderId: string | null
  initialContext: SupportCaseCustomerContext | null
  onOrderLinked: (order: SupportCaseCustomerOrder) => void
}) {
  const [context, setContext] = useState<SupportCaseCustomerContext | null>(initialContext)
  const [loading, setLoading] = useState(!initialContext)
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false)
  const [ticketsLoadingMore, setTicketsLoadingMore] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [role, setRole] = useState<OrderRoleFilter>("all")
  const [pending, startTransition] = useTransition()
  const skipDefaultOrdersForCase = useRef<string | null>(caseId)
  const generationRef = useRef(0)
  const seedRef = useRef(initialContext)
  seedRef.current = initialContext

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const generation = ++generationRef.current
    let cancelled = false
    skipDefaultOrdersForCase.current = caseId
    setSearch("")
    setDebouncedSearch("")
    setRole("all")
    setOrdersLoadingMore(false)
    setTicketsLoadingMore(false)
    const seed = seedRef.current
    if (seed) {
      setContext(seed)
      setLoading(false)
    } else {
      setLoading(true)
      setContext(null)
    }
    void getSupportCaseCustomerContextAction(caseId).then((result) => {
      if (cancelled || !shouldApplyCustomerPanelPage(generation, generationRef.current)) return
      if ("error" in result) {
        if (!seed) {
          toast.error(result.error)
          setContext(null)
        }
      } else {
        setContext(result.data)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [caseId])

  useEffect(() => {
    const isDefault = role === "all" && !debouncedSearch
    if (isDefault && skipDefaultOrdersForCase.current === caseId) return

    skipDefaultOrdersForCase.current = null
    const generation = generationRef.current
    let cancelled = false
    setOrdersLoadingMore(true)
    void listSupportCaseCustomerOrdersAction({
      case_id: caseId,
      offset: 0,
      role,
      search: debouncedSearch,
    }).then((result) => {
      const stale =
        cancelled || !shouldApplyCustomerPanelPage(generation, generationRef.current)
      setOrdersLoadingMore(false)
      if (stale) return
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setContext((prev) =>
        prev
          ? { ...prev, orders: result.orders, ordersHasMore: result.hasMore, ordersTotal: result.total }
          : prev,
      )
    })
    return () => {
      cancelled = true
      setOrdersLoadingMore(false)
    }
  }, [caseId, debouncedSearch, role])

  function loadMoreOrders() {
    if (!context) return
    const generation = generationRef.current
    setOrdersLoadingMore(true)
    void listSupportCaseCustomerOrdersAction({
      case_id: caseId,
      offset: context.orders.length,
      role,
      search: debouncedSearch,
    }).then((result) => {
      setOrdersLoadingMore(false)
      if (!shouldApplyCustomerPanelPage(generation, generationRef.current)) return
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setContext((prev) =>
        prev
          ? {
              ...prev,
              orders: [...prev.orders, ...result.orders],
              ordersHasMore: result.hasMore,
              ordersTotal: result.total,
            }
          : prev,
      )
    })
  }

  function loadMoreTickets() {
    if (!context) return
    const generation = generationRef.current
    setTicketsLoadingMore(true)
    void listSupportCaseCustomerTicketsAction({
      case_id: caseId,
      offset: context.tickets.length,
    }).then((result) => {
      setTicketsLoadingMore(false)
      if (!shouldApplyCustomerPanelPage(generation, generationRef.current)) return
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setContext((prev) =>
        prev
          ? {
              ...prev,
              tickets: [...prev.tickets, ...result.tickets],
              relatedCases: [...prev.tickets, ...result.tickets],
              ticketsHasMore: result.hasMore,
              ticketsTotal: result.total,
            }
          : prev,
      )
    })
  }

  function connectOrder(order: SupportCaseCustomerOrder) {
    if (
      linkedOrderId &&
      linkedOrderId !== order.id &&
      !window.confirm("Replace the order currently connected to this case?")
    ) {
      return
    }
    startTransition(async () => {
      const result = await linkSupportCaseOrderAction({
        case_id: caseId,
        order_id: order.id,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      onOrderLinked(result.order)
      toast.success(`Connected order ${result.order.orderRef ?? result.order.id.slice(0, 8)}`)
    })
  }

  return {
    context,
    loading,
    ordersLoadingMore,
    ticketsLoadingMore,
    search,
    role,
    pending,
    setSearch,
    setRole,
    loadMoreOrders,
    loadMoreTickets,
    connectOrder,
  }
}
