"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import {
  instantBankPayoutFeeUsd,
  netUsdAfterInstantBankFee,
  STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE,
} from "@/lib/utils/stripe-connect-cashout"
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StripeConnectSetupDialog } from "@/components/features/earnings/stripe-connect-setup-dialog"
import { AlertCircle, Building2, CheckCircle2, Loader2, Shield, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

/** Mirrors Stripe Connect external bank accounts returned by `/api/stripe/connect/status`. */
export interface StripeConnectBankAccountRow {
  id: string
  last4: string | null
  bankName: string | null
  defaultForCurrency: boolean
  currency: string
}

export interface StripeConnectStatusPayload {
  hasAccount: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  bankLast4: string | null
  bankName: string | null
  defaultExternalAccountId: string | null
  /** Linked US bank accounts on the Stripe Connect account (ACH). */
  bankAccounts?: StripeConnectBankAccountRow[]
  /**
   * When true, the platform may remove banks via API (Custom Connect).
   * Express accounts use Stripe’s embedded UI only — see `confirmRemoveBank` / Remove flow.
   */
  bankAccountsDeletableViaPlatformApi?: boolean
}

interface StripeTransferHistoryRow {
  id: string
  amount: string | number
  fee_amount?: string | number | null
  payout_speed?: string | null
  stripe_transfer_id: string | null
  stripe_payout_id?: string | null
  status: string
  created_at: string
}

export interface StripeBankPayoutSectionProps {
  availableBalance: number
  stripeConfigured: boolean
  connectStatus: StripeConnectStatusPayload | null
  transferHistory: StripeTransferHistoryRow[]
  onRefresh: () => void | Promise<void>
  /** Called after a successful bank cash-out so the page can update balances immediately. */
  onCashOutSettled?: (detail: {
    amountUsd: number
    availableBalanceAfter: number
    lifetimeCashedOutAfter: number
    speed: "standard" | "instant"
  }) => void
}

function TransferStatusBadge({
  status,
  payoutSpeed,
}: {
  status: string
  payoutSpeed?: string | null
}) {
  const u = status.toUpperCase()
  if (u === "SUCCEEDED") {
    const isStandard = payoutSpeed?.toLowerCase() === "standard"
    if (isStandard) {
      return (
        <Badge
          variant="secondary"
          className="bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-100 dark:border-blue-800"
        >
          Processing
        </Badge>
      )
    }
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
  onCashOutSettled,
}: StripeBankPayoutSectionProps) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupUseManagement, setSetupUseManagement] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [amountStr, setAmountStr] = useState("")
  const [payoutSpeed, setPayoutSpeed] = useState<"standard" | "instant">("standard")
  const [submitting, setSubmitting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<StripeConnectBankAccountRow | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [defaultBusyId, setDefaultBusyId] = useState<string | null>(null)
  /** Full-screen layer inside the cash-out dialog for readable payout errors (replaces easy-to-miss toasts). */
  const [cashOutError, setCashOutError] = useState<{ title: string; detail: string } | null>(null)

  const bankRows: StripeConnectBankAccountRow[] = useMemo(() => {
    const fromApi = connectStatus?.bankAccounts
    if (fromApi && fromApi.length > 0) {
      return fromApi
    }
    if (connectStatus?.bankLast4) {
      return [
        {
          id: connectStatus.defaultExternalAccountId ?? "",
          last4: connectStatus.bankLast4,
          bankName: connectStatus.bankName,
          defaultForCurrency: true,
          currency: "usd",
        },
      ]
    }
    return []
  }, [connectStatus])

  const ready =
    Boolean(connectStatus?.payoutsEnabled) &&
    bankRows.length > 0 &&
    Boolean(bankRows.some((b) => b.last4))

  const openCashOut = useCallback(() => {
    setCashOutError(null)
    setAmountStr(availableBalance > 0 ? availableBalance.toFixed(2) : "")
    setPayoutSpeed("standard")
    setCashOpen(true)
  }, [availableBalance])

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amountStr)
    return Number.isFinite(n) ? n : NaN
  }, [amountStr])

  const instantFeePreview = useMemo(() => {
    if (payoutSpeed !== "instant" || !Number.isFinite(parsedAmount)) return null
    return instantBankPayoutFeeUsd(parsedAmount)
  }, [payoutSpeed, parsedAmount])

  const netAfterInstantPreview = useMemo(() => {
    if (payoutSpeed !== "instant" || !Number.isFinite(parsedAmount)) return null
    return netUsdAfterInstantBankFee(parsedAmount)
  }, [payoutSpeed, parsedAmount])

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
        body: JSON.stringify({ amount, speed: payoutSpeed }),
      })
      const data = (await res.json()) as {
        error?: string
        errorDetail?: string
        message?: string
        amountUsd?: number
        availableBalanceAfter?: number
        lifetimeCashedOutAfter?: number
        speed?: "standard" | "instant"
      }
      if (!res.ok) {
        const err = data.error ?? "Payout failed"
        const detail = data.errorDetail?.trim()
        if (detail) {
          setCashOutError({ title: err, detail })
        } else {
          toast.error(err, { duration: 20_000 })
        }
        return
      }
      const amountUsd = Number(data.amountUsd)
      const availableBalanceAfter = Number(data.availableBalanceAfter)
      const lifetimeCashedOutAfter = Number(data.lifetimeCashedOutAfter)
      if (
        Number.isFinite(amountUsd) &&
        Number.isFinite(availableBalanceAfter) &&
        Number.isFinite(lifetimeCashedOutAfter)
      ) {
        onCashOutSettled?.({
          amountUsd,
          availableBalanceAfter,
          lifetimeCashedOutAfter,
          speed: data.speed ?? "standard",
        })
      }
      toast.success(data.message ?? "Payout initiated", {
        description:
          Number.isFinite(availableBalanceAfter) && Number.isFinite(amountUsd)
            ? `We moved $${amountUsd.toFixed(2)} from your available balance. You now have $${availableBalanceAfter.toFixed(2)} available.`
            : undefined,
        duration: 12_000,
      })
      setCashOpen(false)
      await onRefresh()
    } catch {
      toast.error("Something went wrong. Try again.", { duration: 20_000 })
    } finally {
      setSubmitting(false)
    }
  }, [amountStr, payoutSpeed, onRefresh, onCashOutSettled])

  const setDefaultBank = useCallback(
    async (externalAccountId: string) => {
      setDefaultBusyId(externalAccountId)
      try {
        const res = await fetch("/api/stripe/connect/external-accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalAccountId }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          toast.error(data.error ?? "Could not update default bank")
          return
        }
        toast.success("Default payout bank updated")
        await onRefresh()
      } catch {
        toast.error("Something went wrong. Try again.")
      } finally {
        setDefaultBusyId(null)
      }
    },
    [onRefresh],
  )

  const openPayoutManagement = useCallback(() => {
    setSetupUseManagement(true)
    setSetupOpen(true)
  }, [])

  const confirmRemoveBank = useCallback(async () => {
    const target = removeTarget
    if (!target) return
    setRemoveBusy(true)
    try {
      if (!target.id?.trim()) {
        toast.info("Opening Stripe’s payout settings", {
          description: "Remove or update the bank in the secure window.",
        })
        setRemoveTarget(null)
        openPayoutManagement()
        return
      }

      // Express / Standard-style Connect: Stripe does not allow platform DELETE — open embedded management instead.
      if (connectStatus?.bankAccountsDeletableViaPlatformApi !== true) {
        toast.info("Opening Stripe’s payout settings", {
          description: "Remove or change banks in the secure window below. If this is your only default, add another bank first.",
        })
        setRemoveTarget(null)
        openPayoutManagement()
        return
      }

      const res = await fetch("/api/stripe/connect/external-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalAccountId: target.id }),
      })
      const data = (await res.json()) as { error?: string }

      if (res.ok) {
        toast.success("Bank removed")
        setRemoveTarget(null)
        await onRefresh()
        return
      }

      if (res.status === 400 || res.status === 403 || res.status === 502) {
        toast.info("Opening Stripe’s payout settings", {
          description:
            data.error ??
            "Finish removing the bank in the secure window. If this is your only default, add another bank first.",
        })
        setRemoveTarget(null)
        openPayoutManagement()
        return
      }

      toast.error(data.error ?? "Could not remove this bank account. Try again.")
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setRemoveBusy(false)
    }
  }, [removeTarget, connectStatus?.bankAccountsDeletableViaPlatformApi, onRefresh, openPayoutManagement])

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
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Payout accounts
                </p>
                <Button
                  type="button"
                  className={cn(
                    "rounded-full font-medium",
                    "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
                  )}
                  onClick={openPayoutManagement}
                >
                  Manage payout banks
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Reswell can’t store bank numbers — this opens Stripe’s secure form to add, change, or remove payout
                accounts (remove usually requires two linked banks first).
              </p>
              <ul className="space-y-2">
                {bankRows.map((row) => {
                  const canMutate = Boolean(row.id)
                  const showRemove = Boolean(row.last4)
                  const showDefaultCta =
                    canMutate && bankRows.length > 1 && !row.defaultForCurrency
                  return (
                    <li
                      key={row.id || `${row.last4}-${row.bankName}`}
                      className="rounded-xl border border-border/80 bg-muted/15 px-4 py-3 flex flex-wrap items-center gap-3 justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {row.bankName ?? "Bank account"}{" "}
                          <span className="text-muted-foreground font-normal">
                            ····{row.last4 ?? "••••"}
                          </span>
                          {row.defaultForCurrency ? (
                            <Badge
                              variant="secondary"
                              className="ml-2 align-middle text-[10px] uppercase tracking-wide"
                            >
                              Default
                            </Badge>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {showDefaultCta ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            disabled={defaultBusyId !== null}
                            onClick={() => void setDefaultBank(row.id)}
                          >
                            {defaultBusyId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              "Use for payouts"
                            )}
                          </Button>
                        ) : null}
                        {showRemove ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-full text-destructive hover:text-destructive"
                            disabled={removeBusy}
                            onClick={() => setRemoveTarget(row)}
                            aria-label="Remove bank account"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
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
            <p className="text-xs text-muted-foreground leading-snug mb-3">
              New payouts appear here right away. Standard (free) transfers stay{" "}
              <span className="text-foreground font-medium">Processing</span> while the ACH to your bank is in flight;
              instant transfers show <span className="text-foreground font-medium">Sent</span> once the payout to your bank
              has started.
            </p>
            {transferHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bank transfers yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {transferHistory.map((row) => {
                  const amt =
                    typeof row.amount === "string" ? parseFloat(row.amount) : row.amount
                  const feeRaw = row.fee_amount
                  const feeNum =
                    feeRaw != null && feeRaw !== ""
                      ? typeof feeRaw === "string"
                        ? parseFloat(feeRaw)
                        : feeRaw
                      : 0
                  const isInstant = row.payout_speed?.toLowerCase() === "instant"
                  const ref =
                    row.stripe_payout_id?.trim() || row.stripe_transfer_id?.trim() || "—"
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
                      <span className="font-medium tabular-nums shrink-0 inline-flex flex-wrap items-center gap-2">
                        ${Number.isFinite(amt) ? amt.toFixed(2) : row.amount}
                        {isInstant ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase tracking-wide h-5 px-1.5"
                          >
                            Instant
                          </Badge>
                        ) : null}
                        {Number.isFinite(feeNum) && feeNum > 0 ? (
                          <span className="text-xs font-normal text-muted-foreground tabular-nums">
                            fee ${feeNum.toFixed(2)}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground truncate min-w-0 font-mono text-[11px] sm:text-xs">
                        {ref}
                      </span>
                      <span className="ml-auto shrink-0">
                        <TransferStatusBadge status={row.status} payoutSpeed={row.payout_speed} />
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

      <Dialog
        open={cashOpen}
        onOpenChange={(open) => {
          setCashOpen(open)
          if (!open) setCashOutError(null)
        }}
      >
        <DialogContent
          className="sm:max-w-md gap-0 overflow-hidden p-0"
          showCloseButton={!cashOutError}
        >
          <div className="relative p-6">
            <div
              className={cn(cashOutError && "pointer-events-none select-none")}
              inert={cashOutError ? true : undefined}
            >
              <DialogHeader>
                <DialogTitle>Cash out to bank</DialogTitle>
                <DialogDescription>
                  {payoutSpeed === "instant" ? (
                    <>
                      We&apos;ll send funds from your Reswell balance through Stripe Connect with an{" "}
                      <span className="font-medium text-foreground">instant payout</span> to your bank when
                      your account and bank support it (timing depends on your bank).
                    </>
                  ) : (
                    <>
                      We&apos;ll move funds from your Reswell balance to your Stripe-connected account. Your
                      bank receives payouts on Stripe&apos;s schedule (typically 2–3 business days).
                    </>
                  )}
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
              <p className="text-xs text-muted-foreground leading-snug">
                Bank transfers use buyer payments that have fully finished processing. Your balance can update
                before every dollar is ready to send—if a transfer is declined, try again after recent sales have
                settled (often a few business days).
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Speed</Label>
              <RadioGroup
                value={payoutSpeed}
                onValueChange={(v) => setPayoutSpeed(v as "standard" | "instant")}
                className="grid gap-3"
              >
                <label
                  htmlFor="payout-standard"
                  className={cn(
                    "flex items-start gap-3 rounded-xl border border-border/80 p-3 cursor-pointer",
                    payoutSpeed === "standard" && "ring-2 ring-primary/30 bg-muted/20",
                  )}
                >
                  <RadioGroupItem value="standard" id="payout-standard" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium leading-tight block">Standard (free)</span>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      ACH — typically 2–3 business days. No extra fee.
                    </p>
                  </div>
                </label>
                <label
                  htmlFor="payout-instant"
                  className={cn(
                    "flex items-start gap-3 rounded-xl border border-border/80 p-3 cursor-pointer",
                    payoutSpeed === "instant" && "ring-2 ring-primary/30 bg-muted/20",
                  )}
                >
                  <RadioGroupItem value="instant" id="payout-instant" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium leading-tight inline-flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" aria-hidden />
                      Instant
                    </span>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      {(STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE * 100).toFixed(1)}% fee — funds usually arrive within
                      minutes when Stripe supports instant payout to your linked account.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {payoutSpeed === "instant" &&
            instantFeePreview != null &&
            netAfterInstantPreview != null &&
            Number.isFinite(parsedAmount) ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between gap-2">
                  <span>Instant fee ({(STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE * 100).toFixed(1)}%)</span>
                  <span className="tabular-nums text-foreground">${instantFeePreview.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2 font-medium text-foreground">
                  <span>Estimated to your bank</span>
                  <span className="tabular-nums">${netAfterInstantPreview.toFixed(2)}</span>
                </div>
                <p className="text-[11px] leading-snug pt-1 border-t border-border/50">
                  The fee is deducted from your cash-out amount; your wallet is debited the full amount
                  entered above.
                </p>
              </div>
            ) : null}

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
            </div>

            {cashOutError ? (
              <div
                className="absolute inset-0 z-[100] flex flex-col rounded-lg bg-background/98 p-6 shadow-[inset_0_0_0_1px_hsl(var(--border))] backdrop-blur-[2px] supports-[backdrop-filter]:bg-background/90"
                role="alert"
                aria-labelledby="stripe-cashout-error-title"
                aria-describedby="stripe-cashout-error-desc"
              >
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="flex gap-3">
                    <AlertCircle
                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <h2
                        id="stripe-cashout-error-title"
                        className="pr-2 text-base font-semibold leading-snug text-foreground"
                      >
                        {cashOutError.title}
                      </h2>
                      <p
                        id="stripe-cashout-error-desc"
                        className="max-h-[min(50vh,320px)] overflow-y-auto text-sm leading-relaxed text-muted-foreground"
                      >
                        {cashOutError.detail}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2">
                    <Button
                      type="button"
                      className="w-full rounded-full"
                      autoFocus
                      onClick={() => setCashOutError(null)}
                    >
                      Back to cash out
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full"
                      asChild
                    >
                      <Link href="/contact">Contact support</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this bank account?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? connectStatus?.bankAccountsDeletableViaPlatformApi === true
                  ? `Remove ${removeTarget.bankName ?? "bank"} ending in ${removeTarget.last4 ?? "••••"} from your payout options. If you have more than one bank and this is the default, choose “Use for payouts” on another account first.`
                  : `Remove ${removeTarget.bankName ?? "bank"} ending in ${removeTarget.last4 ?? "••••"} from your payout options. We’ll open Stripe’s secure window next — complete removal there. If you have more than one bank and this is the default, choose “Use for payouts” on another account first.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBusy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={removeBusy}
              onClick={() => void confirmRemoveBank()}
            >
              {removeBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin inline" aria-hidden />
                  Removing…
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
