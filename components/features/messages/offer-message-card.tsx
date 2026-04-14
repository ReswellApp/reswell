"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SellerOfferResponseDialog, type OfferRowLite } from "./seller-offer-response-dialog"
import { format, isToday, isYesterday } from "date-fns"

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending"
    case "ACCEPTED":
      return "Accepted"
    case "DECLINED":
      return "Declined"
    case "COUNTERED":
      return "Countered"
    case "EXPIRED":
      return "Expired"
    case "WITHDRAWN":
      return "Withdrawn"
    case "COMPLETED":
      return "Completed"
    default:
      return status
  }
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACCEPTED") return "default"
  if (status === "DECLINED" || status === "EXPIRED" || status === "WITHDRAWN") {
    return "secondary"
  }
  if (status === "COUNTERED") return "outline"
  return "secondary"
}

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

export function OfferMessageCard({
  messageContent,
  offer,
  isSeller,
  listingTitle,
  listPrice,
  minOfferAmount,
  minOfferPct,
  createdAt,
  onThreadRefresh,
}: {
  messageContent: string
  offer: OfferRowLite
  isSeller: boolean
  listingTitle: string
  listPrice: number
  minOfferAmount: number
  minOfferPct: number
  createdAt: string
  onThreadRefresh: () => void | Promise<void>
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const pending = offer.status === "PENDING"
  const showSellerActions = isSeller && pending

  return (
    <>
      <div
        className={cn(
          "w-full max-w-[min(100%,20rem)] rounded-[20px] border border-border/60 bg-card p-3.5 text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
          "ring-1 ring-foreground/[0.04]",
        )}
      >
        {isSeller && (
          <p className="mb-2 text-[12px] leading-snug text-muted-foreground">
            <Link
              href="/dashboard/offers?tab=received"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition-colors hover:decoration-foreground/60"
            >
              Manage all offers in your dashboard
            </Link>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          >
            Offer
          </Badge>
          <Badge variant={statusVariant(offer.status)} className="rounded-lg text-[11px] font-medium">
            {statusLabel(offer.status)}
          </Badge>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-medium leading-snug text-foreground">
          {messageContent}
        </p>
        {showSellerActions && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              size="sm"
              className="h-10 w-full rounded-xl text-[14px] font-semibold sm:min-w-[8rem] sm:flex-1"
              onClick={() => setDialogOpen(true)}
            >
              Review & respond
            </Button>
          </div>
        )}
        {!showSellerActions && isSeller && !pending && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            {offer.status === "COUNTERED"
              ? "Waiting for the buyer to reply to your counter."
              : "This offer is closed."}
          </p>
        )}
        {!isSeller && pending && (
          <p className="mt-2 text-[12px] text-muted-foreground">Waiting for the seller to respond.</p>
        )}
        <p className="mt-2 text-[11px] tabular-nums leading-none text-muted-foreground">
          {formatThreadTime(createdAt)}
        </p>
      </div>

      <SellerOfferResponseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        offer={offer}
        listingTitle={listingTitle}
        listPrice={listPrice}
        minOfferAmount={minOfferAmount}
        minOfferPct={minOfferPct}
        onCompleted={onThreadRefresh}
      />
    </>
  )
}
