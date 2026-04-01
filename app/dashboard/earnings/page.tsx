"use client"

import { useEffect, useState, useCallback } from "react"
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
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletData {
  id: string
  balance: string
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

interface StripeBalance {
  available: number
  pending: number
  connected: boolean
  payoutsEnabled?: boolean
  stripeUnavailable?: boolean
  error?: string
}

interface ConnectStatus {
  connected: boolean
  readyToReceivePayments?: boolean
  onboardingComplete?: boolean
  account?: { payouts_enabled: boolean; details_submitted: boolean } | null
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stripeBalance, setStripeBalance] = useState<StripeBalance | null>(null)
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Setup button state
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [earningsRes, stripeBalanceRes, connectRes] = await Promise.all([
        fetch("/api/earnings"),
        fetch("/api/stripe/connect/balance"),
        fetch("/api/stripe/connect/account-status"),
      ])

      if (earningsRes.ok) {
        const data = await earningsRes.json()
        setWallet(data.wallet)
        setTransactions(data.transactions)
      }

      if (stripeBalanceRes.ok) {
        setStripeBalance(await stripeBalanceRes.json())
      }

      if (connectRes.ok) {
        setConnectStatus(await connectRes.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Real-time wallet updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("earnings_wallet")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets" }, () => {
        fetchData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  // Navigate to the Stripe transition page (which fetches the link and redirects)
  const handleOpenStripeDashboard = useCallback(() => {
    window.location.href = "/dashboard/earnings/cashout"
  }, [])

  // Start / continue Stripe Connect onboarding
  const handleSetupPayouts = useCallback(async () => {
    setConnectError(null)
    setConnectLoading(true)
    try {
      // Ensure account exists
      let accountId: string
      if (!connectStatus?.account) {
        const createRes = await fetch("/api/stripe/connect/create-account", { method: "POST" })
        const createData = await createRes.json()
        if (!createRes.ok) {
          setConnectError(createData.error ?? "Failed to create account")
          return
        }
        accountId = createData.accountId ?? createData.stripe_account_id
      } else {
        const { data: row } = await fetch("/api/stripe/connect/account-status")
          .then((r) => r.json())
          .then((d) => ({ data: d.account }))
        accountId = (row as { stripe_account_id?: string })?.stripe_account_id ?? ""
        if (!accountId) {
          setConnectError("Could not find your Stripe account.")
          return
        }
      }

      const linkRes = await fetch("/api/stripe/connect/onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      })
      const linkData = await linkRes.json()
      if (!linkRes.ok) {
        setConnectError(linkData.error ?? "Failed to generate onboarding link")
        return
      }
      window.location.href = linkData.url
    } catch {
      setConnectError("An unexpected error occurred.")
    } finally {
      setConnectLoading(false)
    }
  }, [connectStatus])

  const walletBalance = wallet ? parseFloat(wallet.balance) : 0
  const lifetimeEarned = wallet ? parseFloat(wallet.lifetime_earned) : 0
  const lifetimeCashedOut = wallet ? parseFloat(wallet.lifetime_cashed_out) : 0

  const hasStripeAccount = connectStatus?.connected && connectStatus?.account
  const isFullySetUp = connectStatus?.readyToReceivePayments && connectStatus?.onboardingComplete
  const needsOnboarding = hasStripeAccount && !connectStatus?.onboardingComplete
  const awaitingActivation = hasStripeAccount && connectStatus?.onboardingComplete && !connectStatus?.readyToReceivePayments

  // Always use wallet DB balance as the source of truth.
  // Stripe's connected account balance is $0 until actual transfers are made.
  const displayAvailable = walletBalance
  const displayPending = stripeBalance?.connected && !stripeBalance?.stripeUnavailable && !stripeBalance?.error
    ? stripeBalance.pending
    : 0

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
          <h1 className="text-2xl font-bold tracking-tight">Earnings & Payouts</h1>
          <p className="text-muted-foreground">Your earnings from marketplace sales.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} className="text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* ── Cash out section ────────────────────────────────────────────────── */}
      <Card className={displayAvailable > 0 ? "border-primary/30 bg-primary/5" : ""}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Banknote className="h-4 w-4" />
                Your earnings
                <Badge variant="outline" className="text-xs font-normal ml-1">
                  <ShieldCheck className="h-3 w-3 mr-1" />Managed by Stripe
                </Badge>
              </div>

              <div className="flex items-baseline gap-6 mt-2 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Available</p>
                  <p className="text-4xl font-bold text-primary">${displayAvailable.toFixed(2)}</p>
                </div>
                {displayPending > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Pending</p>
                    <p className="text-2xl font-semibold text-muted-foreground">${displayPending.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action button — state-driven */}
            <div className="flex flex-col gap-2 min-w-[200px]">
              {isFullySetUp ? (
                <Button
                  onClick={handleOpenStripeDashboard}
                  disabled={displayAvailable <= 0}
                  className="gap-2 font-semibold"
                >
                  {displayAvailable > 0
                    ? <>Cash out ${displayAvailable.toFixed(2)} via Stripe <ExternalLink className="h-3.5 w-3.5" /></>
                    : <>No balance to cash out</>}
                </Button>
              ) : awaitingActivation ? (
                <Button variant="outline" onClick={fetchData} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Check activation status
                </Button>
              ) : (
                <Button onClick={handleSetupPayouts} disabled={connectLoading} className="gap-2">
                  {connectLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Setting up…</>
                  ) : needsOnboarding ? (
                    <><ShieldCheck className="h-4 w-4" />Complete verification</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4" />Set up payouts</>
                  )}
                </Button>
              )}

              {isFullySetUp && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenStripeDashboard}
                  className="text-muted-foreground text-xs gap-1.5"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Stripe dashboard
                </Button>
              )}
            </div>
          </div>

          {/* Error messages */}
          {connectError && (
            <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {connectError}
            </div>
          )}

          {/* Context copy based on state */}
          <div className="mt-4 text-sm text-muted-foreground space-y-1">
            {isFullySetUp ? (
              <>
                <p>Bank account and payout settings are managed securely by Stripe.</p>
                <p>Typical arrival: 2–5 days (standard) · ~30 min (instant, 1.5% fee)</p>
              </>
            ) : awaitingActivation ? (
              <p>Your verification is complete — Stripe is finishing activation. This usually takes a few minutes.</p>
            ) : needsOnboarding ? (
              <p>Complete your Stripe verification to enable payouts to your bank account.</p>
            ) : (
              <p>Set up your payout account to transfer earnings directly to your bank. Takes about 2 minutes.</p>
            )}
          </div>
        </CardContent>
      </Card>

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
                When a buyer purchases your listing, earnings are credited to your balance after marketplace fees.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium mb-1">
                <ArrowUpRight className="h-4 w-4" /> Spend
              </div>
              <p className="text-muted-foreground">
                Use your balance to buy gear from other sellers — no extra fees for internal purchases.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Banknote className="h-4 w-4" /> Cash out
              </div>
              <p className="text-muted-foreground">
                Transfer to your bank via Stripe. Standard: 2–5 days, free. Instant: ~30 min, 1.5% fee.
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
  // e.g. 'Sold "Longboard Pickle x Stix - 9\'3"" (card, 7% + processing fee)'
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

  // e.g. 'Purchased "Title" (incl. shipping $X.XX)'
  const purchasedMatch = raw.match(/^Purchased "(.+?)"(.*)$/)
  if (purchasedMatch) {
    const itemName = purchasedMatch[1]
    const rest = purchasedMatch[2].trim()
    return { title: `Purchased — ${itemName}`, subtitle: rest.replace(/^\(|\)$/g, "").trim() }
  }

  // Cash-out: 'Cash-out $X via paypal (standard, fee: $0.00, payout: $X)'
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

  // Recalculate running balances chronologically from $0
  // (DB balance_after may be stale from earlier data issues)
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  let running = 0
  const balanceMap = new Map<string, number>()
  for (const t of sorted) {
    running = Math.round((running + parseFloat(t.amount)) * 100) / 100
    balanceMap.set(t.id, running)
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {transactions.map((t) => {
            const amt = parseFloat(t.amount)
            const isPositive = amt >= 0
            const balAfter = balanceMap.get(t.id) ?? 0
            const { title, subtitle } = parseDescription(t.description, t.type)
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isPositive ? "bg-neutral-100" : "bg-muted"}`}>
                  {isPositive
                    ? <ArrowDownLeft className="h-4 w-4 text-neutral-700" />
                    : <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
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
                  <p className={`text-sm font-semibold ${isPositive ? "text-neutral-900" : "text-muted-foreground"}`}>
                    {isPositive ? "+" : ""}${Math.abs(amt).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bal: ${balAfter.toFixed(2)}
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
