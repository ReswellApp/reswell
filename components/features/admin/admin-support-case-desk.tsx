"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, Package, User } from "lucide-react"
import { toast } from "sonner"
import {
  ensureOrderSupportThreadAdminAction,
  sendOrderSupportAdminReplyAction,
} from "@/lib/actions/orderSupportThread"
import {
  ensureSupportTicketThreadAdminAction,
  sendSupportTicketAdminReplyAction,
} from "@/lib/actions/contactMessagesAdmin"
import { AdminEmbeddedSupportThread } from "@/components/features/admin/admin-embedded-support-thread"
import { SupportMacrosPicker } from "@/components/features/admin/support-macros-picker"
import { ProtectionClaimDesk } from "@/components/features/admin/protection-claim-desk"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  SUPPORT_CASE_KIND_LABEL,
  formatSupportCaseReference,
} from "@/lib/utils/support-case-display"
import type { SupportCaseKind } from "@/lib/types/supportCase"
import { adminSupportCaseHref, supportCaseResponseHref } from "@/lib/utils/support-case-paths"

const CASES_INBOX_HREF = "/admin/contact-messages"

type AdminSupportCaseDeskProps = {
  backend: "order_support" | "contact_message"
  caseId: string
  subject: string
  kind: SupportCaseKind
  customerUserId: string | null
  customerLabel: string
  supportConversationId: string | null
  orderId: string | null
  orderRef: string | null
  preview: string
  initialStatus: string
}

export function AdminSupportCaseDesk({
  backend,
  caseId,
  subject,
  kind,
  customerUserId,
  customerLabel,
  supportConversationId: initialConversationId,
  orderId,
  orderRef,
  preview,
  initialStatus,
}: AdminSupportCaseDeskProps) {
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [reply, setReply] = useState("")
  const [reloadToken, setReloadToken] = useState(0)
  const [pending, startTransition] = useTransition()

  function linkThread() {
    startTransition(async () => {
      if (backend === "order_support") {
        const res = await ensureOrderSupportThreadAdminAction({ case_id: caseId })
        if ("error" in res && res.error) {
          toast.error(res.error)
          return
        }
        if (res.support_conversation_id) {
          setConversationId(res.support_conversation_id)
          setReloadToken((n) => n + 1)
        }
        toast.success("Thread linked")
        return
      }
      const res = await ensureSupportTicketThreadAdminAction({ ticket_id: caseId })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      if (res.support_conversation_id) {
        setConversationId(res.support_conversation_id)
        setReloadToken((n) => n + 1)
      }
      toast.success("Thread linked")
    })
  }

  function sendReply() {
    const body = reply.trim()
    if (!body) {
      toast.error("Write a message first.")
      return
    }
    startTransition(async () => {
      if (backend === "order_support") {
        const res = await sendOrderSupportAdminReplyAction({ case_id: caseId, content: body })
        if ("error" in res && res.error) {
          toast.error(res.error)
          return
        }
        if (res.support_conversation_id) setConversationId(res.support_conversation_id)
      } else {
        const res = await sendSupportTicketAdminReplyAction({ ticket_id: caseId, content: body })
        if ("error" in res && res.error) {
          toast.error(res.error)
          return
        }
        if (res.support_conversation_id) setConversationId(res.support_conversation_id)
      }
      setReply("")
      setReloadToken((n) => n + 1)
      toast.success("Sent to customer")
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
          <Link href="/admin/contact-messages">
            <ArrowLeft className="h-4 w-4" />
            Case inbox
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {customerUserId ? (
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/admin/users/${customerUserId}`}>
                <User className="mr-1.5 h-3.5 w-3.5" />
                User
              </Link>
            </Button>
          ) : null}
          {orderId ? (
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/admin/orders/${orderId}`}>
                <Package className="mr-1.5 h-3.5 w-3.5" />
                Order
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href={supportCaseResponseHref(caseId)} target="_blank">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Customer view
            </Link>
          </Button>
        </div>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{SUPPORT_CASE_KIND_LABEL[kind]}</Badge>
          <Badge variant="outline">{initialStatus.replaceAll("_", " ")}</Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {formatSupportCaseReference(caseId)}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{subject}</h1>
        {orderRef ? (
          <p className="text-sm text-muted-foreground">Order {orderRef}</p>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Original request
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{preview}</p>
          </div>

          <AdminEmbeddedSupportThread
            conversationId={conversationId}
            customerUserId={customerUserId}
            customerLabel={customerLabel}
            orderSupportRequestId={backend === "order_support" ? caseId : null}
            reloadToken={reloadToken}
            size="tall"
            emptyAction={
              <Button type="button" size="sm" variant="outline" onClick={linkThread} disabled={pending}>
                Link thread
              </Button>
            }
          />

          <div className="space-y-3 rounded-[20px] border border-border/55 bg-background p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reply to customer
            </p>
            <SupportMacrosPicker
              kindFilter={kind === "protection_claim" ? "protection_claim" : kind === "cancel_request" ? "cancel_request" : null}
              vars={{ order_ref: orderRef ?? undefined, name: customerLabel }}
              onInsert={(text) => setReply((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))}
            />
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Message the customer will see under Help…"
              rows={4}
              className="resize-y text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={sendReply} disabled={pending || !reply.trim()}>
                {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Send to customer
              </Button>
              <Button asChild type="button" size="sm" variant="ghost">
                <Link href={adminSupportCaseHref(caseId)}>Refresh</Link>
              </Button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {backend === "order_support" && kind === "protection_claim" ? (
            <ProtectionClaimDesk orderSupportRequestId={caseId} />
          ) : null}
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Tip</p>
            <p className="mt-1 leading-relaxed">
              Inbox triage stays at{" "}
              <Link href={CASES_INBOX_HREF} className="underline underline-offset-2">
                Cases
              </Link>
              . This page is the full Help thread for a single case.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
