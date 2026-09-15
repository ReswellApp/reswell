"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
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
import type { CaseInboxThisOrderSnapshot } from "@/lib/admin/case-customer-panel"
import { CaseCustomerIdentity } from "@/components/features/admin/case-customer-identity"
import { CaseCustomerOrderBrowser, type OrderRoleFilter } from "@/components/features/admin/case-customer-order-browser"
import { CaseCustomerTickets } from "@/components/features/admin/case-customer-tickets"
import { CaseInboxThisOrderCard } from "@/components/features/admin/case-inbox-this-order-card"

interface CaseCustomerContextProps {
  caseId: string
  linkedOrderId: string | null
  linkedOrderRef: string | null
  thisOrder: CaseInboxThisOrderSnapshot | null
  initialContext?: SupportCaseCustomerContext | null
  onOrderLinked: (order: SupportCaseCustomerOrder) => void
}

export function CaseCustomerContext({
  caseId,
  linkedOrderId,
  linkedOrderRef,
  thisOrder,
  initialContext = null,
  onOrderLinked,
}: CaseCustomerContextProps) {
  const [context, setContext] = useState<SupportCaseCustomerContext | null>(initialContext)
  const [loading, setLoading] = useState(!initialContext)
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false)
  const [ticketsLoadingMore, setTicketsLoadingMore] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [role, setRole] = useState<OrderRoleFilter>("all")
  const [pending, startTransition] = useTransition()
  const skipOrdersQuery = useRef(true)
  const seedRef = useRef(initialContext)
  seedRef.current = initialContext

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    skipOrdersQuery.current = true
    setSearch("")
    setDebouncedSearch("")
    setRole("all")
    const seed = seedRef.current
    if (seed) {
      setContext(seed)
      setLoading(false)
    } else {
      setLoading(true)
      setContext(null)
    }
    void getSupportCaseCustomerContextAction(caseId).then((result) => {
      if (cancelled) return
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
    if (skipOrdersQuery.current) {
      skipOrdersQuery.current = false
      return
    }
    let cancelled = false
    setOrdersLoadingMore(true)
    void listSupportCaseCustomerOrdersAction({
      case_id: caseId,
      offset: 0,
      role,
      search: debouncedSearch,
    }).then((result) => {
      if (cancelled) return
      setOrdersLoadingMore(false)
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
    }
  }, [caseId, debouncedSearch, role])

  function loadMoreOrders() {
    if (!context) return
    setOrdersLoadingMore(true)
    void listSupportCaseCustomerOrdersAction({
      case_id: caseId,
      offset: context.orders.length,
      role,
      search: debouncedSearch,
    }).then((result) => {
      setOrdersLoadingMore(false)
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
    setTicketsLoadingMore(true)
    void listSupportCaseCustomerTicketsAction({
      case_id: caseId,
      offset: context.tickets.length,
    }).then((result) => {
      setTicketsLoadingMore(false)
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading customer…
      </div>
    )
  }

  if (!context) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 px-3 py-4">
        <p className="text-xs font-medium">Could not load customer history</p>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <CaseCustomerIdentity context={context} />
      <CaseInboxThisOrderCard
        linkedOrderId={linkedOrderId}
        linkedOrderRef={linkedOrderRef}
        order={thisOrder}
      />
      <CaseCustomerTickets
        tickets={context.tickets}
        total={context.ticketsTotal}
        hasMore={context.ticketsHasMore}
        loadingMore={ticketsLoadingMore}
        onLoadMore={loadMoreTickets}
      />
      {context.profile ? (
        <CaseCustomerOrderBrowser
          orders={context.orders}
          total={context.ordersTotal}
          hasMore={context.ordersHasMore}
          loadingMore={ordersLoadingMore}
          linkedOrderId={linkedOrderId}
          pending={pending}
          search={search}
          role={role}
          onSearchChange={setSearch}
          onRoleChange={setRole}
          onLoadMore={loadMoreOrders}
          onConnect={connectOrder}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
          Purchases and sales appear after this email is connected to a member account.
        </p>
      )}
    </section>
  )
}
