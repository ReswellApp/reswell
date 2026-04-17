"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Banknote,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  DollarSign,
  RefreshCw,
  HelpCircle,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PayoutModal from "@/components/PayoutModal"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import {
  StripeBankPayoutSection,
  type StripeConnectStatusPayload,
} from "@/components/features/earnings/stripe-bank-payout-section"
import { toast } from "sonner"
import { getEarningsWalletData } from "@/app/actions/wallet"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletData {
  id: string
  balance: string
  pending_balance?: string
  lifetime_earned: string
  lifetime_spent: string
  lifetime_cashed_out: string
}

interface Transaction {
  id: string
  type: "sale" | "purchase" | "cashout" | "deposit" | "refund"
  amount: string
  balance_after: string
  description: string
  status: string
  created_at: string
}

interface PayPalPayoutHistoryItem {
  id: string
  amount: string | number
  paypal_email: string
  status: string
  created_at: string
}

interface StripeTransferHistoryItem {
  id: string
  amount: string | number
  fee_amount?: string | number | null
  payout_speed?: string | null
  stripe_transfer_id: string | null
  stripe_payout_id?: string | null
  status: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status.toLowerCase()) {
    case "completed":
      return <Badge variant="default" className="bg-neutral-100 text-neutral-900 border-neutral-200"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
    case "pending":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
    case "processing":
    case "in_transit":
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />In transit</Badge>
    case "failed":
    case "rejected":
    case "canceled":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function PayPalPayoutStatusBadge({ status }: { status: string }) {
  const u = status.toUpperCase()
  if (u === "SUCCESS") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-transparent">
        Paid
      </Badge>
    )
  }
  if (u === "FAILED") {
    return <Badge variant="destructive">Failed</Badge>
  }
  if (u === "UNCLAIMED") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1">
            <Badge variant="secondary" className="bg-muted text-muted-foreground cursor-help">
              Unclaimed
            </Badge>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent>PayPal email not claimed</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-800"
    >
      Processing
    </Badge>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [paypalEmail, setPaypalEmail] = useState("")
  const [paypalDisplayName, setPaypalDisplayName] = useState("")
  const [paypalPayerId, setPaypalPayerId] = useState("")
  const [paypalModalOpen, setPaypalModalOpen] = useState(false)
  const [paypalDisplayBalance, setPaypalDisplayBalance] = useState(0)
  const [paypalHistory, setPaypalHistory] = useState<PayPalPayoutHistoryItem[]>([])
  const [stripeConnectStatus, setStripeConnectStatus] = useState<StripeConnectStatusPayload | null>(null)
  const [stripeTransferHistory, setStripeTransferHistory] = useState<StripeTransferHistoryItem[]>([])
  const [paypalDisconnectOpen, setPaypalDisconnectOpen] = useState(false)
  const [paypalDisconnecting, setPaypalDisconnecting] = useState(false)

  /**
   * After a Stripe bank cash-out, `getEarningsWalletData()` can briefly return a stale balance
   * (same-tab refetch / realtime racing the write). We keep authoritative numbers from the POST
   * response and merge them into fetches until the server read matches or the window expires.
   */
  const stripeCashOutWalletTrustRef = useRef<{
    balance: string
    lifetime_cashed_out: string
    expires: number
  } | null>(null)

  /** Prevents stale concurrent fetches (e.g. wallet realtime before `wallet_transactions` insert) from overwriting newer data. */
  const fetchGenerationRef = useRef(0)

  const stripePayoutsEnabled =
    typeof process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === "string" &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.trim().length > 0

  const fetchData = useCallback(async (opts?: { showRefreshIndicator?: boolean }) => {
    const gen = ++fetchGenerationRef.current
    if (opts?.showRefreshIndicator) setRefreshing(true)
    try {
      const [earningsData, paypalRes, stripeStatusRes, stripePayoutsRes] = await Promise.all([
        getEarningsWalletData(),
        fetch("/api/payouts/paypal", { cache: "no-store" }),
        fetch("/api/stripe/connect/status", { cache: "no-store" }),
        fetch("/api/payouts/stripe", { cache: "no-store" }),
      ])

      if (gen !== fetchGenerationRef.current) return

      if (!earningsData.error && earningsData.wallet) {
        let nextWallet = earningsData.wallet as WalletData
        const trust = stripeCashOutWalletTrustRef.current
        if (trust && Date.now() < trust.expires) {
          nextWallet = {
            ...nextWallet,
            balance: trust.balance,
            lifetime_cashed_out: trust.lifetime_cashed_out,
          }
          const serverBal = parseFloat(String(earningsData.wallet.balance))
          const trustBal = parseFloat(trust.balance)
          if (
            Number.isFinite(serverBal) &&
            Number.isFinite(trustBal) &&
            Math.abs(serverBal - trustBal) < 0.02
          ) {
            stripeCashOutWalletTrustRef.current = null
          }
        }
        setWallet(nextWallet)
        setTransactions(earningsData.transactions as Transaction[])
      }

      if (paypalRes.ok) {
        const p = await paypalRes.json()
        setPaypalHistory((p.history as PayPalPayoutHistoryItem[]) ?? [])
        setPaypalEmail((p.paypalEmail as string) ?? "")
        setPaypalDisplayName((p.paypalDisplayName as string) ?? "")
        setPaypalPayerId((p.paypalPayerId as string) ?? "")
      }

      if (stripeStatusRes.ok) {
        const s = (await stripeStatusRes.json()) as StripeConnectStatusPayload
        setStripeConnectStatus(s)
      } else {
        setStripeConnectStatus(null)
      }

      if (stripePayoutsRes.ok) {
        const t = (await stripePayoutsRes.json()) as { history?: StripeTransferHistoryItem[] }
        setStripeTransferHistory(t.history ?? [])
      } else {
        setStripeTransferHistory([])
      }
    } finally {
      if (gen === fetchGenerationRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paypal = params.get("paypal")
    if (paypal === "connected") {
      toast.success("PayPal connected successfully!")
      window.history.replaceState({}, "", "/dashboard/earnings")
      void fetchData()
    } else if (paypal === "error") {
      toast.error("PayPal connection failed. Please try again.")
      window.history.replaceState({}, "", "/dashboard/earnings")
    }
  }, [fetchData])

  // Real-time: wallet balance + ledger rows (cash-out inserts `wallet_transactions` after `wallets` updates)
  useEffect(() => {
    if (!wallet?.id) return
    const supabase = createClient()
    const wid = wallet.id
    const channel = supabase
      .channel(`earnings_wallet_${wid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallets", filter: `id=eq.${wid}` },
        () => {
          void fetchData()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_transactions",
          filter: `wallet_id=eq.${wid}`,
        },
        () => {
          void fetchData()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [wallet?.id, fetchData])

  const walletBalance = wallet ? parseFloat(wallet.balance) : 0
  const lifetimeEarned = wallet ? parseFloat(wallet.lifetime_earned) : 0
  const lifetimeCashedOut = wallet ? parseFloat(wallet.lifetime_cashed_out) : 0
  const pendingRaw = wallet ? parseFloat(wallet.pending_balance ?? "0") : 0

  const displayAvailable = walletBalance
  const displayPending = Number.isFinite(pendingRaw) ? pendingRaw : 0
  const displayTotal = displayAvailable + displayPending

  useEffect(() => {
    setPaypalDisplayBalance(displayAvailable)
  }, [displayAvailable])

  const handlePayPalModalSuccess = useCallback(
    (amount: number, email: string) => {
      setPaypalDisplayBalance((prev) =>
        Math.round(Math.max(0, prev - amount) * 100) / 100,
      )
      setPaypalEmail(email)
      void fetchData()
    },
    [fetchData],
  )

  const paypalConnected = Boolean(paypalPayerId || paypalEmail)

  const handleStripeBankCashOutSettled = useCallback(
    (detail: {
      amountUsd: number
      availableBalanceAfter: number
      lifetimeCashedOutAfter: number
    }) => {
      const balance = detail.availableBalanceAfter.toFixed(2)
      const lifetime_cashed_out = detail.lifetimeCashedOutAfter.toFixed(2)
      stripeCashOutWalletTrustRef.current = {
        balance,
        lifetime_cashed_out,
        expires: Date.now() + 45_000,
      }
      setWallet((w) => (w ? { ...w, balance, lifetime_cashed_out } : w))
    },
    [],
  )

  const confirmDisconnectPayPal = useCallback(async () => {
    setPaypalDisconnecting(true)
    try {
      const res = await fetch("/api/auth/paypal/disconnect", { method: "POST" })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not disconnect PayPal")
        return
      }
      toast.success("PayPal disconnected")
      setPaypalDisconnectOpen(false)
      setPaypalEmail("")
      setPaypalDisplayName("")
      setPaypalPayerId("")
      await fetchData()
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setPaypalDisconnecting(false)
    }
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Earnings</h1>
          <p className="text-muted-foreground">Your earnings from marketplace sales.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={() => void fetchData({ showRefreshIndicator: true })}
          className="text-muted-foreground"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </Button>
      </div>

      {/* ── Balance summary ───────────────────────────────────────────────────── */}
      <Card className={displayTotal > 0 ? "border-primary/30 bg-primary/5" : ""}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Banknote className="h-4 w-4" />
                Your Reswell Bucks balance
              </div>

              <div className="mt-2 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Total (including pending)</p>
                  <p className="text-4xl font-bold text-primary">${displayTotal.toFixed(2)}</p>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Available to spend</p>
                    <p className="text-xl font-semibold tabular-nums">${displayAvailable.toFixed(2)}</p>
                  </div>
                  {displayPending > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Pending (until delivery)</p>
                      <p className="text-xl font-semibold tabular-nums text-muted-foreground">
                        ${displayPending.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-muted-foreground space-y-1">
            <p>
              Pending earnings show as soon as a buyer pays; they move to <span className="text-foreground">available</span>{" "}
              after the buyer confirms delivery or local pickup is verified. You can only shop or cash out from available
              funds.
            </p>
            <p>
              {stripePayoutsEnabled
                ? "Cash out to your bank (ACH) or PayPal — choose the option that works best for you."
                : "Cash out to PayPal below. Add a publishable Stripe key to enable bank transfers."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Bank (Stripe Connect) ───────────────────────────────────────────── */}
      {stripePayoutsEnabled && (
        <StripeBankPayoutSection
          availableBalance={displayAvailable}
          stripeConfigured={stripePayoutsEnabled}
          connectStatus={stripeConnectStatus}
          transferHistory={stripeTransferHistory}
          onRefresh={fetchData}
          onCashOutSettled={handleStripeBankCashOutSettled}
        />
      )}

      {/* ── PayPal payout ───────────────────────────────────────────────────── */}
      <TooltipProvider delayDuration={200}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pay out via PayPal</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Funds are sent from Reswell&apos;s PayPal business account. Complete the flow in one place — no new tabs.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {paypalConnected ? (
              <div className="rounded-xl border border-border/80 bg-muted/15 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    PayPal payout
                  </p>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                    {paypalDisplayName ? `${paypalDisplayName} · ` : ""}
                    {paypalEmail || paypalPayerId || "Connected"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setPaypalDisconnectOpen(true)}
                >
                  Disconnect PayPal
                </Button>
              </div>
            ) : null}

            <Button
              type="button"
              className="w-full sm:w-auto bg-[#0070ba] hover:bg-[#005ea6] text-white font-medium"
              disabled={paypalDisplayBalance < 10}
              onClick={() => setPaypalModalOpen(true)}
            >
              Cash out via PayPal — ${paypalDisplayBalance.toFixed(2)}
            </Button>
            {paypalDisplayBalance < 10 && (
              <p className="text-xs text-muted-foreground">
                Minimum PayPal cash out is $10.00.
              </p>
            )}

            <PayoutModal
              isOpen={paypalModalOpen}
              onClose={() => setPaypalModalOpen(false)}
              availableBalance={paypalDisplayBalance}
              savedPaypalEmail={paypalEmail}
              savedPaypalDisplayName={paypalDisplayName}
              savedPaypalPayerId={paypalPayerId}
              onSuccess={handlePayPalModalSuccess}
              onPaypalConnectionChange={fetchData}
            />

            <div className="pt-2 border-t">
              <h3 className="text-sm font-semibold mb-3">PayPal payout history</h3>
              {paypalHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No PayPal payouts yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {paypalHistory.map((row) => {
                    const amt = typeof row.amount === "string" ? parseFloat(row.amount) : row.amount
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
                        <span className="text-muted-foreground truncate min-w-0">
                          → {row.paypal_email}
                        </span>
                        <span className="ml-auto shrink-0">
                          <PayPalPayoutStatusBadge status={row.status} />
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={paypalDisconnectOpen} onOpenChange={setPaypalDisconnectOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect PayPal?</AlertDialogTitle>
              <AlertDialogDescription>
                You won&apos;t be able to cash out to PayPal until you connect an account again. Your
                Reswell balance is unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={paypalDisconnecting}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={paypalDisconnecting}
                onClick={() => void confirmDisconnectPayPal()}
              >
                {paypalDisconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                    Disconnecting…
                  </>
                ) : (
                  "Disconnect"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>

      {/* ── Lifetime stats ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              Lifetime earned
            </div>
            <div className="text-2xl font-bold">${lifetimeEarned.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Banknote className="h-4 w-4" />
              Total cashed out
            </div>
            <div className="text-2xl font-bold">${lifetimeCashedOut.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Transaction history ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Transaction history</h2>
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="cashouts">Cashouts</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <TransactionList transactions={transactions} />
          </TabsContent>
          <TabsContent value="sales">
            <TransactionList transactions={transactions.filter((t) => ["sale", "deposit", "refund"].includes(t.type))} />
          </TabsContent>
          <TabsContent value="cashouts">
            <TransactionList transactions={transactions.filter((t) => t.type === "cashout")} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How your earnings work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium mb-1">
                <ArrowDownLeft className="h-4 w-4" /> Earn
              </div>
              <p className="text-muted-foreground">
                When a buyer pays, you receive {SELLER_SHARE_PERCENT}% of the sale (platform fee {MARKETPLACE_FEE_PERCENT}%)
                — it shows as <span className="text-foreground">pending</span> right away and moves to{" "}
                <span className="text-foreground">available</span> after delivery or pickup is completed.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium mb-1">
                <ArrowUpRight className="h-4 w-4" /> Spend
              </div>
              <p className="text-muted-foreground">
                Only <span className="text-foreground">available</span> funds can be used to buy from other sellers — pending
                earnings unlock after delivery or pickup.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Banknote className="h-4 w-4" /> Cash out
              </div>
              <p className="text-muted-foreground">
                {stripePayoutsEnabled
                  ? "Cash out to your bank or PayPal from the sections above. Minimum $10 for each method."
                  : "Cash out to PayPal from the section above. Minimum $10."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Description parser ───────────────────────────────────────────────────────

function parseDescription(raw: string, type: string): { title: string; subtitle: string } {
  if (raw.startsWith("Pending — ")) {
    const m = raw.match(/^Pending — Sold "(.+?)"\s*/)
    if (m) {
      return { title: `Pending — ${m[1]}`, subtitle: "Awaiting delivery or pickup" }
    }
  }
  if (raw.startsWith("Available — ")) {
    const m = raw.match(/^Available — Sold "(.+?)"\s*/)
    if (m) {
      return { title: `Available — ${m[1]}`, subtitle: "Ready to spend or cash out" }
    }
  }

  // e.g. 'Sold "Longboard Pickle x Stix - 9\'3"" (7% fee: $X.XX, card)'
  const soldMatch = raw.match(/^Sold "(.+?)"\s*(?:\(([^)]+)\))?$/)
  if (soldMatch) {
    const itemName = soldMatch[1]
    const detail = soldMatch[2] ?? ""
    const isCard = /card/i.test(detail)
    const feeMatch = detail.match(/(\d+(?:\.\d+)?)%/)
    const feePct = feeMatch ? `${feeMatch[1]}% fee` : null
    const parts = [
      isCard ? "Card payment" : null,
      feePct,
    ].filter(Boolean).join(" · ")
    return { title: `Sold — ${itemName}`, subtitle: parts }
  }

  // Buyer refund credit: 'Refund — "Title" ($X.XX returned to your balance)'
  const buyerRefundMatch = raw.match(/^Refund — "(.+?)"\s*\(\$[\d.]+\s+returned to your balance\)/)
  if (buyerRefundMatch) {
    return { title: `Refund — ${buyerRefundMatch[1]}`, subtitle: "Refunded to your Reswell Bucks" }
  }

  // Seller refund debit: 'Refund — "Board" (partial/full refund …)'
  const refundMatch = raw.match(/^Refund — "(.+?)"/)
  if (refundMatch) {
    const itemName = refundMatch[1]
    const isWallet = /Reswell Bucks/i.test(raw)
    const isPending = /pending earnings/i.test(raw)
    const subtitle = isWallet
      ? "Reswell Bucks sale reversed"
      : isPending
        ? "Pending earnings reversed"
        : "Card sale reversed"
    return { title: `Refund — ${itemName}`, subtitle }
  }

  // e.g. 'Purchased "Title" (incl. shipping $X.XX)'
  const purchasedMatch = raw.match(/^Purchased "(.+?)"(.*)$/)
  if (purchasedMatch) {
    const itemName = purchasedMatch[1]
    const rest = purchasedMatch[2].trim()
    return { title: `Purchased — ${itemName}`, subtitle: rest.replace(/^\(|\)$/g, "").trim() }
  }

  // Cash-out: 'Cash-out $X via paypal ...' or '... via bank (Stripe...'
  const cashoutStripe = raw.match(/^Cash-out \$[\d.]+ via bank/i)
  if (cashoutStripe) {
    return { title: "Cash out", subtitle: "Bank (ACH via Stripe)" }
  }
  const cashoutMatch = raw.match(/^Cash-out \$[\d.]+ via (\w+)/i)
  if (cashoutMatch) {
    const method = cashoutMatch[1].charAt(0).toUpperCase() + cashoutMatch[1].slice(1)
    return { title: "Cash out", subtitle: `Via ${method}` }
  }

  // Fallback: use the type label as title
  const typeLabel: Record<string, string> = {
    sale: "Sale", purchase: "Purchase", cashout: "Cash out",
    deposit: "Deposit", refund: "Refund",
  }
  return { title: raw || typeLabel[type] || type, subtitle: "" }
}

// ─── Transaction list ─────────────────────────────────────────────────────────

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No transactions yet</p>
          <p className="text-sm text-muted-foreground mt-1">Your transaction history will appear here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {transactions.map((t) => {
            const amt = parseFloat(t.amount)
            const isRelease =
              t.description.startsWith("Available — ") && Math.abs(amt) < 0.0001
            const incoming = amt > 0.0001
            const balAfter = Number.isFinite(parseFloat(t.balance_after))
              ? parseFloat(t.balance_after)
              : 0
            const { title, subtitle } = parseDescription(t.description, t.type)
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    isRelease ? "bg-emerald-50 dark:bg-emerald-950/40" : incoming ? "bg-neutral-100" : "bg-muted"
                  }`}
                >
                  {isRelease ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : incoming ? (
                    <ArrowDownLeft className="h-4 w-4 text-neutral-700" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {subtitle && <span className="ml-1.5 before:content-['·'] before:mr-1.5">{subtitle}</span>}
                    {t.status && t.status !== "completed" && (
                      <span className="ml-1.5 before:content-['·'] before:mr-1.5 capitalize">{t.status}</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${incoming || isRelease ? "text-neutral-900" : "text-muted-foreground"}`}>
                    {isRelease ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">Released to available</span>
                    ) : (
                      <>
                        {incoming ? "+" : ""}${Math.abs(amt).toFixed(2)}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Available: ${balAfter.toFixed(2)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
