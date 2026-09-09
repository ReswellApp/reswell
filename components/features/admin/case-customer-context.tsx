"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  Loader2,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"
import {
  getSupportCaseCustomerContextAction,
  linkSupportCaseOrderAction,
} from "@/lib/actions/supportCaseCustomerContext"
import type {
  SupportCaseCustomerContext,
  SupportCaseCustomerOrder,
} from "@/lib/services/supportCaseCustomerContext"
import { CaseCustomerOrderBrowser } from "@/components/features/admin/case-customer-order-browser"
import { Badge } from "@/components/ui/badge"

interface CaseCustomerContextProps {
  caseId: string
  linkedOrderId: string | null
  onOrderLinked: (order: SupportCaseCustomerOrder) => void
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function CaseCustomerContext({
  caseId,
  linkedOrderId,
  onOrderLinked,
}: CaseCustomerContextProps) {
  const [context, setContext] = useState<SupportCaseCustomerContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getSupportCaseCustomerContextAction(caseId).then((result) => {
      if (cancelled) return
      if ("error" in result) {
        toast.error(result.error)
        setContext(null)
      } else {
        setContext(result.data)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [caseId])

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
        Loading customer activity…
      </div>
    )
  }

  if (!context?.profile) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 px-3 py-4">
        <p className="text-xs font-medium">No Reswell account matched</p>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          Purchases and sales will appear after this email is connected to a member account.
        </p>
      </div>
    )
  }

  const profile = context.profile
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-background p-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link href={`/admin/users/${profile.id}`} className="truncate text-sm font-semibold hover:underline">
                {profile.displayName}
              </Link>
              {profile.verified ? <Badge variant="secondary" className="h-5 text-[9px]">Verified</Badge> : null}
              {context.matchedByEmail ? <Badge variant="outline" className="h-5 text-[9px]">Email match</Badge> : null}
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {profile.email ? <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{profile.email}</p> : null}
              {profile.phone ? <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{profile.phone}</p> : null}
              {profile.location ? <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</p> : null}
              <p>Member since {format(new Date(profile.createdAt), "MMM yyyy")}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
          <div><p className="text-sm font-semibold">{context.commerce.purchases}</p><p className="text-[10px] text-muted-foreground">Purchases · {usd(context.commerce.purchaseSpend)}</p></div>
          <div><p className="text-sm font-semibold">{context.commerce.sales}</p><p className="text-[10px] text-muted-foreground">Sales · {usd(context.commerce.salesVolume)}</p></div>
          <div><p className="text-sm font-semibold">{context.commerce.activeListings}</p><p className="text-[10px] text-muted-foreground">Active listings</p></div>
        </div>
      </div>

      {context.relatedCases.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Previous support cases
          </p>
          <div className="divide-y divide-border/50 rounded-lg border border-border/60 bg-background">
            {context.relatedCases.map((supportCase) => (
              <Link
                key={supportCase.id}
                href={`/admin/contact-messages?view=all&case=${supportCase.id}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/40"
              >
                <span className="min-w-0 truncate">{supportCase.subject}</span>
                <span className="shrink-0 capitalize text-[10px] text-muted-foreground">
                  {supportCase.status.replaceAll("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <CaseCustomerOrderBrowser
        orders={context.orders}
        linkedOrderId={linkedOrderId}
        pending={pending}
        onConnect={connectOrder}
      />
    </section>
  )
}
