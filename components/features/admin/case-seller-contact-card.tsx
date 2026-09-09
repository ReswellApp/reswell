"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Copy,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquarePlus,
  Phone,
  Store,
} from "lucide-react"
import { toast } from "sonner"
import type { AdminOrderParticipant } from "@/lib/db/adminOrders"
import type { SupportCaseKind } from "@/lib/types/supportCase"
import type { SellerSupportOutreachResult } from "@/lib/services/supportCaseSellerOutreach"
import { buildSellerSupportOutreachDraft } from "@/lib/admin/seller-support-outreach"
import { CaseSellerOutreachDialog } from "@/components/features/admin/case-seller-outreach-dialog"
import { Button } from "@/components/ui/button"

interface CaseSellerContactCardProps {
  sourceCaseId: string
  orderRef: string
  caseKind: SupportCaseKind
  issueSummary: string
  seller: AdminOrderParticipant
  onOutreachSent: () => void
}

function sellerName(seller: AdminOrderParticipant): string {
  return (
    (seller.is_shop ? seller.shop_name?.trim() : null) ||
    seller.display_name?.trim() ||
    seller.seller_slug?.trim() ||
    seller.email?.trim() ||
    "Seller"
  )
}

function sellerUsername(seller: AdminOrderParticipant): string | null {
  return (
    seller.display_name?.trim() ||
    seller.seller_slug?.trim() ||
    (seller.is_shop ? seller.shop_name?.trim() : null) ||
    null
  )
}

export function CaseSellerContactCard({
  sourceCaseId,
  orderRef,
  caseKind,
  issueSummary,
  seller,
  onOutreachSent,
}: CaseSellerContactCardProps) {
  const [open, setOpen] = useState(false)
  const [sellerCaseId, setSellerCaseId] = useState<string | null>(null)
  const name = sellerName(seller)
  const location = [seller.city, seller.state].filter(Boolean).join(", ")

  function outreachSent(result: SellerSupportOutreachResult) {
    setSellerCaseId(result.sellerCaseId)
    onOutreachSent()
    toast.success(
      result.sellerEmail
        ? `${result.reused ? "Follow-up sent" : "Seller support case opened"} as Reswell`
        : "Seller case opened, but this seller has no email on file",
    )
  }

  async function copyEmail() {
    if (!seller.email) return
    try {
      await navigator.clipboard.writeText(seller.email)
      toast.success("Seller email copied")
    } catch {
      toast.error("Could not copy seller email")
    }
  }

  const gmailHref = seller.email
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(seller.email)}&su=${encodeURIComponent(`Reswell order ${orderRef}`)}`
    : null

  return (
    <>
      <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Store className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Seller contact
            </p>
            <p className="truncate text-sm font-semibold">{name}</p>
            {seller.email ? (
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" aria-hidden />
                {seller.email}
              </p>
            ) : null}
            {seller.shop_phone ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" aria-hidden />
                {seller.shop_phone}
              </p>
            ) : null}
            {seller.shop_address || location ? (
              <p className="flex items-start gap-1 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {seller.shop_address || location}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" className="h-8" onClick={() => setOpen(true)}>
            <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Contact as Reswell
          </Button>
          {gmailHref ? (
            <Button type="button" size="sm" variant="outline" className="h-8" asChild>
              <a href={gmailHref} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Gmail
              </a>
            </Button>
          ) : null}
          {seller.email ? (
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => void copyEmail()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Copy email
            </Button>
          ) : null}
        </div>

        {sellerCaseId ? (
          <Link
            href={`/admin/contact-messages?view=all&case=${sellerCaseId}`}
            className="block rounded-md bg-muted px-3 py-2 text-xs font-medium hover:underline"
          >
            Open the seller support case →
          </Link>
        ) : null}
      </section>

      <CaseSellerOutreachDialog
        open={open}
        onOpenChange={setOpen}
        sourceCaseId={sourceCaseId}
        orderRef={orderRef}
        sellerName={name}
        defaultMessage={buildSellerSupportOutreachDraft({
          sellerUsername: sellerUsername(seller),
          orderRef,
          kind: caseKind,
          customerText: issueSummary,
        })}
        onSent={outreachSent}
      />
    </>
  )
}
