"use client"

import { useCallback, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StripeConnectSetupDialog } from "@/components/features/earnings/stripe-connect-setup-dialog"
import { Building2, CheckCircle2, Loader2, Shield } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface StripeConnectStatusPayload {
  hasAccount: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  bankLast4: string | null
  bankName: string | null
  defaultExternalAccountId: string | null
}

interface StripeTransferHistoryRow {
  id: string
  amount: string | number
  stripe_transfer_id: string | null
  status: string
  created_at: string
}

export interface StripeBankPayoutSectionProps {
  availableBalance: number
  stripeConfigured: boolean
  connectStatus: StripeConnectStatusPayload | null
  transferHistory: StripeTransferHistoryRow[]
  onRefresh: () => void | Promise<void>
}

function TransferStatusBadge({ status }: { status: string }) {
  const u = status.toUpperCase()
  if (u === "SUCCEEDED") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-transparent">
        Sent
      </Badge>
    )
  }
  if (u === "REVERSED" || u === "FAILED") {
    return <Badge variant="destructive">Reversed</Badge>
  }
  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      {status}
    </Badge>
  )
}

export function StripeBankPayoutSection({
  availableBalance,
  stripeConfigured,
  connectStatus,
  transferHistory,
  onRefresh,
}: StripeBankPayoutSectionProps) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupUseManagement, setSetupUseManagement] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [amountStr, setAmountStr] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const ready =
    Boolean(connectStatus?.payoutsEnabled) &&
    Boolean(connectStatus?.defaultExternalAccountId ?? connectStatus?.bankLast4)

  const openCashOut = useCallback(() => {
    setAmountStr(availableBalance > 0 ? availableBalance.toFixed(2) : "")
    setCashOpen(true)
  }, [availableBalance])

  const submitCashOut = useCallback(async () => {
    const amount = parseFloat(amountStr)
    if (!Number.isFinite(amount) || amount < 10) {
      toast.error("Enter at least $10.00")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/payouts/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Payout failed")
        return
      }
      toast.success(data.message ?? "Funds sent to your Stripe balance")
      setCashOpen(false)
      await onRefresh()
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }, [amountStr, onRefresh])

  if (!stripeConfigured) {
    return null
  }

  return (
    <>
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="pb-2 space-y-1">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
              <Building2 className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold tracking-tight">
                Bank transfer (ACH)
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal leading-snug mt-1">
                Cash out to a US bank account. Powered by Stripe — your routing and account numbers
                never touch Reswell servers.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Bank details are collected and stored only by Stripe.</span>
          </div>

          {ready ? (
            <div className="rounded-xl border border-border/80 bg-muted/15 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Payout account
                </p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {connectStatus?.bankName ?? "Bank account"}{" "}
                  <span className="text-muted-foreground font-normal">
                    ····{connectStatus?.bankLast4 ?? "••••"}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 rounded-full"
                onClick={() => {
                  setSetupUseManagement(true)
                  setSetupOpen(true)
                }}
              >
                Update
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="default"
              className="w-full sm:w-auto rounded-full font-medium"
              onClick={() => {
                setSetupUseManagement(false)
                setSetupOpen(true)
              }}
            >
              Add bank account
            </Button>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              type="button"
              className={cn(
                "w-full sm:w-auto rounded-full font-medium",
                "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
              )}
              disabled={!ready || availableBalance < 10}
              onClick={openCashOut}
            >
              {ready ? `Cash out — $${availableBalance.toFixed(2)}` : "Complete bank setup to cash out"}
            </Button>
            {ready && availableBalance < 10 && (
              <p className="text-xs text-muted-foreground">Minimum bank cash out is $10.00.</p>
            )}
          </div>

          <div className="pt-2 border-t border-border/60">
            <h3 className="text-sm font-semibold mb-3">Bank transfer history</h3>
            {transferHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bank transfers yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {transferHistory.map((row) => {
                  const amt =
                    typeof row.amount === "string" ? parseFloat(row.amount) : row.amount
                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-b border-border/60 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-muted-foreground tabular-nums w-[7.5rem] shrink-0">
                        {new Date(row.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="font-medium tabular-nums shrink-0">
                        ${Number.isFinite(amt) ? amt.toFixed(2) : row.amount}
                      </span>
                      <span className="text-muted-foreground truncate min-w-0 font-mono text-[11px] sm:text-xs">
                        {row.stripe_transfer_id ?? "—"}
                      </span>
                      <span className="ml-auto shrink-0">
                        <TransferStatusBadge status={row.status} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <StripeConnectSetupDialog
        open={setupOpen}
        onOpenChange={(o) => {
          setSetupOpen(o)
          if (!o) void onRefresh()
        }}
        useManagement={setupUseManagement}
      />

      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cash out to bank</DialogTitle>
            <DialogDescription>
              We&apos;ll move funds from your Reswell balance to your Stripe-connected account. Your
              bank receives payouts on Stripe&apos;s schedule (typically 2–3 business days).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="stripe-cash-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  id="stripe-cash-amount"
                  inputMode="decimal"
                  className="pl-7 tabular-nums"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Available: ${availableBalance.toFixed(2)} · Minimum $10.00
              </p>
            </div>
            <Button
              type="button"
              className="w-full rounded-full"
              disabled={submitting}
              onClick={() => void submitCashOut()}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm transfer
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
