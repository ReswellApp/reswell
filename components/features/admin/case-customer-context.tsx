"use client"

import { Loader2 } from "lucide-react"
import type {
  SupportCaseCustomerContext,
  SupportCaseCustomerOrder,
} from "@/lib/services/supportCaseCustomerContext"
import type { CaseInboxThisOrderSnapshot } from "@/lib/admin/case-customer-panel"
import { useCaseCustomerPanel } from "@/components/features/admin/hooks/use-case-customer-panel"
import { CaseCustomerIdentity } from "@/components/features/admin/case-customer-identity"
import { CaseCustomerOrderBrowser } from "@/components/features/admin/case-customer-order-browser"
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
  const panel = useCaseCustomerPanel({
    caseId,
    linkedOrderId,
    initialContext,
    onOrderLinked,
  })

  if (panel.loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading customer…
      </div>
    )
  }

  if (!panel.context) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 px-3 py-4">
        <p className="text-xs font-medium">Could not load customer history</p>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <CaseCustomerIdentity context={panel.context} />
      <CaseInboxThisOrderCard
        linkedOrderId={linkedOrderId}
        linkedOrderRef={linkedOrderRef}
        order={thisOrder ?? panel.context.thisOrder}
      />
      <CaseCustomerTickets
        tickets={panel.context.tickets}
        total={panel.context.ticketsTotal}
        hasMore={panel.context.ticketsHasMore}
        loadingMore={panel.ticketsLoadingMore}
        onLoadMore={panel.loadMoreTickets}
      />
      {panel.context.profile ? (
        <CaseCustomerOrderBrowser
          orders={panel.context.orders}
          total={panel.context.ordersTotal}
          hasMore={panel.context.ordersHasMore}
          loadingMore={panel.ordersLoadingMore}
          linkedOrderId={linkedOrderId}
          pending={panel.pending}
          search={panel.search}
          role={panel.role}
          onSearchChange={panel.setSearch}
          onRoleChange={panel.setRole}
          onLoadMore={panel.loadMoreOrders}
          onConnect={panel.connectOrder}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
          Purchases and sales appear after this email is connected to a member account.
        </p>
      )}
    </section>
  )
}
