"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Banknote,
  Landmark,
  CreditCard,
  Mail,
  Coins,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  TrendingUp,
  Zap,
  Plus,
  Trash2,
  Star,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react"
import { PayoutModal } from "@/components/payouts/payout-modal"
import { AddPaymentMethodDialog } from "@/components/payouts/add-payment-method-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface StripeAccount {
  id: string
  stripe_account_id: string
  account_status: "PENDING" | "ACTIVE" | "RESTRICTED" | "DISABLED"
  payouts_enabled: boolean
  charges_enabled: boolean
  details_submitted: boolean
}

type ConnectStatusApi = {
  connected?: boolean
  account?: StripeAccount | null
  readyToReceivePayments?: boolean
  onboardingComplete?: boolean
  requirementsStatus?: string
}

interface SellerBalance {
  available_balance: number
  pending_balance: number
  reswell_credit: number
  lifetime_earned: number
  lifetime_paid_out: number
}

interface PaymentMethod {
  id: string
  type: "BANK_ACCOUNT" | "DEBIT_CARD" | "PAYPAL"
  is_default: boolean
  bank_name?: string
  account_last4?: string
  routing_last4?: string
  card_brand?: string
  card_last4?: string
  card_exp?: string
  paypal_email?: string
  verified: boolean
}

interface Payout {
  id: string
  amount: number
  fee: number
  net_amount: number
  method: "ACH" | "INSTANT" | "PAYPAL" | "RESWELL_CREDIT"
  status: "PENDING" | "IN_TRANSIT" | "PAID" | "FAILED" | "CANCELED"
  destination: string
  estimated_arrival: string | null
  failure_reason: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pmIcon(type: string, size = "h-4 w-4") {
  if (type === "BANK_ACCOUNT") return <Landmark className={size} />
  if (type === "DEBIT_CARD") return <CreditCard className={size} />
  if (type === "PAYPAL") return <Mail className={size} />
  return <Coins className={size} />
}

function pmLabel(pm: PaymentMethod): string {
  if (pm.type === "BANK_ACCOUNT") return `${pm.bank_name ?? "Bank"} ••••${pm.account_last4}`
  if (pm.type === "DEBIT_CARD") return `${pm.card_brand ?? "Card"} ••••${pm.card_last4}`
  if (pm.type === "PAYPAL") return pm.paypal_email ?? "PayPal"
  return "Unknown"
}

function methodLabel(method: string): string {
  if (method === "ACH") return "Bank transfer"
  if (method === "INSTANT") return "Instant"
  if (method === "PAYPAL") return "PayPal"
  if (method === "RESWELL_CREDIT") return "Reswell credit"
  return method
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PAID":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      )
    case "IN_TRANSIT":
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          In transit
        </Badge>
      )
    case "PENDING":
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
    case "FAILED":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    case "CANCELED":
      return (
        <Badge variant="outline">
          <XCircle className="h-3 w-3 mr-1" />
          Canceled
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const searchParams = useSearchParams()
  const setupParam = searchParams.get("setup")

  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<SellerBalance>({
    available_balance: 0,
    pending_balance: 0,
    reswell_credit: 0,
    lifetime_earned: 0,
    lifetime_paid_out: 0,
  })
  const [stripeAccount, setStripeAccount] = useState<StripeAccount | null>(null)
  const [connectReadyToReceivePayments, setConnectReadyToReceivePayments] = useState(false)
  const [connectOnboardingComplete, setConnectOnboardingComplete] = useState(false)
  const [connectRequirementsStatus, setConnectRequirementsStatus] = useState<string | undefined>()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])

  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const [payoutModalOpen, setPayoutModalOpen] = useState(false)
  const [addMethodOpen, setAddMethodOpen] = useState(false)

  const accountIdParam = searchParams.get("accountId")

  const fetchData = useCallback(async () => {
    try {
      // Fetch balance/payouts/methods
      const res = await fetch("/api/payouts")
      if (res.ok) {
        const data = await res.json()
        const b = data.balance
        setBalance({
          available_balance: parseFloat(b.available_balance ?? 0),
          pending_balance: parseFloat(b.pending_balance ?? 0),
          reswell_credit: parseFloat(b.reswell_credit ?? 0),
          lifetime_earned: parseFloat(b.lifetime_earned ?? 0),
          lifetime_paid_out: parseFloat(b.lifetime_paid_out ?? 0),
        })
        setPaymentMethods(data.paymentMethods ?? [])
        setPayouts(data.payouts ?? [])
      }

      // Fetch Connect account status (always live from Stripe V2 when configured)
      const statusUrl = accountIdParam
        ? `/api/stripe/connect/account-status?accountId=${encodeURIComponent(accountIdParam)}`
        : "/api/stripe/connect/account-status"
      const accountRes = await fetch(statusUrl)
      if (accountRes.ok) {
        const accountData = (await accountRes.json()) as ConnectStatusApi
        setStripeAccount(accountData.account ?? null)
        setConnectReadyToReceivePayments(
          accountData.readyToReceivePayments ?? accountData.account?.payouts_enabled ?? false
        )
        setConnectOnboardingComplete(
          accountData.onboardingComplete ?? accountData.account?.details_submitted ?? false
        )
        setConnectRequirementsStatus(accountData.requirementsStatus)
      }
    } finally {
      setLoading(false)
    }
  }, [accountIdParam])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Show success/refresh banners based on setup query param
  const setupComplete = setupParam === "complete"
  const setupRefresh = setupParam === "refresh"

  const handleSetupPayouts = async () => {
    setConnectError("")
    setConnectLoading(true)
    try {
      // Step 1: ensure account exists
      let accountId: string
      if (!stripeAccount) {
        const createRes = await fetch("/api/stripe/connect/create-account", { method: "POST" })
        const createData = await createRes.json()
        if (!createRes.ok) {
          setConnectError(createData.error ?? "Failed to create account")
          return
        }
        accountId = createData.accountId ?? createData.stripe_account_id
      } else {
        accountId = stripeAccount.stripe_account_id
      }

      // Step 2: get onboarding link (optional explicit accountId for debugging)
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
      setConnectError("An unexpected error occurred")
    } finally {
      setConnectLoading(false)
    }
  }

  const handleRemoveMethod = async (id: string) => {
    setRemovingId(id)
    try {
      const res = await fetch(`/api/payouts/payment-methods/${id}`, { method: "DELETE" })
      if (res.ok) {
        setPaymentMethods((prev) => prev.filter((m) => m.id !== id))
      }
    } finally {
      setRemovingId(null)
    }
  }

  const handleSetDefault = async (id: string) => {
    setSettingDefaultId(id)
    try {
      const res = await fetch(`/api/payouts/payment-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make_default: true }),
      })
      if (res.ok) {
        setPaymentMethods((prev) =>
          prev.map((m) => ({ ...m, is_default: m.id === id }))
        )
      }
    } finally {
      setSettingDefaultId(null)
    }
  }

  const available = balance.available_balance
  const hasAccount = Boolean(stripeAccount)
  const isFullySetUp = connectReadyToReceivePayments && connectOnboardingComplete
  const needsOnboarding = hasAccount && !connectOnboardingComplete
  const awaitingActivation = hasAccount && connectOnboardingComplete && !connectReadyToReceivePayments

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">Transfer your earnings to your bank, debit card, or PayPal.</p>
      </div>

      {/* Setup banners */}
      {setupComplete && isFullySetUp && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">Payout account connected!</p>
            <p className="text-sm text-green-700 mt-0.5">
              Your Stripe account is active. You can now cash out your earnings.
            </p>
          </div>
        </div>
      )}

      {setupRefresh && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">Setup not completed</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Your Stripe onboarding session expired. Click below to continue where you left off.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleSetupPayouts} disabled={connectLoading}>
            {connectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue setup"}
          </Button>
        </div>
      )}

      {/* Awaiting Stripe capability activation (onboarding done, transfers not active yet) */}
      {awaitingActivation && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-6 flex flex-col sm:flex-row gap-4 items-start">
            <Clock className="h-10 w-10 text-amber-700 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="font-semibold text-lg text-amber-950">Awaiting activation</h2>
              <p className="text-sm text-amber-900/80 mt-1 max-w-lg">
                Your onboarding is complete. Stripe is finishing activation for payouts and transfers.
                This usually resolves within a short time — refresh this page or check your Stripe Express dashboard.
              </p>
              {connectRequirementsStatus && (
                <p className="text-xs text-amber-800 mt-2">Requirements: {connectRequirementsStatus}</p>
              )}
            </div>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check status
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stripe Connect setup prompt */}
      {!isFullySetUp && (needsOnboarding || !hasAccount) && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                {!hasAccount ? (
                  <>
                    <h2 className="font-semibold text-lg">Set up payouts to get paid</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                      Connect a Stripe account to receive your earnings. Stripe handles identity
                      verification, tax forms (1099s), and bank connections — takes about 2 minutes.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />Bank account</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />Debit card</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />Instant payouts</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />Tax forms (1099)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="font-semibold text-lg">Complete your setup</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                      Stripe still needs information before you can receive payouts. Continue the
                      guided setup — it usually takes just a few minutes.
                    </p>
                  </>
                )}
                {connectError && (
                  <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {connectError}
                  </p>
                )}
              </div>
              <Button onClick={handleSetupPayouts} disabled={connectLoading} className="flex-shrink-0">
                {connectLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Setting up...</>
                ) : !hasAccount ? (
                  <><ArrowRight className="h-4 w-4 mr-2" />Set up payouts</>
                ) : (
                  <><ExternalLink className="h-4 w-4 mr-2" />Complete setup</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Balance overview ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your balance</h2>
          <Button variant="ghost" size="sm" onClick={fetchData} className="text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Available */}
          <Card className={available > 0 ? "border-primary/30 bg-primary/5" : ""}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Banknote className="h-4 w-4" />
                Available
              </div>
              <div className="text-3xl font-bold text-primary">${available.toFixed(2)}</div>
              <div className="mt-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={available < 0.01 || (!isFullySetUp && balance.reswell_credit >= 0)}
                          onClick={() => setPayoutModalOpen(true)}
                        >
                          Cash out
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {available < 0.01 && (
                      <TooltipContent className="max-w-xs text-center">
                        No available balance yet. Earnings are released after the buyer&apos;s 30-day protection window closes.
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>

          {/* Pending */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                Pending
              </div>
              <div className="text-2xl font-bold">${balance.pending_balance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1.5">Held during buyer protection window</p>
            </CardContent>
          </Card>

          {/* In transit */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <ArrowRight className="h-4 w-4" />
                In transit
              </div>
              <div className="text-2xl font-bold">
                ${payouts
                  .filter((p) => p.status === "IN_TRANSIT")
                  .reduce((s, p) => s + parseFloat(String(p.net_amount)), 0)
                  .toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">On its way to you</p>
            </CardContent>
          </Card>

          {/* Reswell credit */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Coins className="h-4 w-4" />
                Reswell credit
              </div>
              <div className="text-2xl font-bold">${balance.reswell_credit.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1.5">Use to buy gear on Reswell</p>
            </CardContent>
          </Card>
        </div>

        {/* Lifetime stats */}
        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lifetime earned</p>
              <p className="font-semibold text-lg">${balance.lifetime_earned.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total paid out</p>
              <p className="font-semibold text-lg">${balance.lifetime_paid_out.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payout methods ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Payout methods</h2>
          <Button size="sm" variant="outline" onClick={() => setAddMethodOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add method
          </Button>
        </div>

        {paymentMethods.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Landmark className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No payout methods yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Add a bank account, debit card, or PayPal to start withdrawing your earnings.
                </p>
              </div>
              <Button onClick={() => setAddMethodOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add payout method
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center gap-3 p-4">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {pmIcon(pm.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{pmLabel(pm)}</span>
                        {pm.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-2.5 w-2.5 mr-1" />
                            Default
                          </Badge>
                        )}
                        {pm.type === "DEBIT_CARD" && (
                          <Badge variant="outline" className="text-xs text-amber-700 border-amber-200">
                            <Zap className="h-2.5 w-2.5 mr-1" />
                            Instant eligible
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pm.type === "BANK_ACCOUNT" && "2–5 business days · Free"}
                        {pm.type === "DEBIT_CARD" && `${pm.card_exp ? `Expires ${pm.card_exp} · ` : ""}~30 min · 1.5% fee`}
                        {pm.type === "PAYPAL" && "1–3 business days · Free"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!pm.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => handleSetDefault(pm.id)}
                          disabled={settingDefaultId === pm.id}
                        >
                          {settingDefaultId === pm.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Set default"
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMethod(pm.id)}
                        disabled={removingId === pm.id}
                      >
                        {removingId === pm.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Payout history ── */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Payout history</h2>

        {payouts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Banknote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No payouts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your payout history will appear here once you make your first withdrawal.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span>Method</span>
                <span>Destination</span>
                <span>Status</span>
              </div>

              <div className="divide-y">
                {payouts.map((payout) => (
                  <PayoutRow key={payout.id} payout={payout} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Earnings breakdown info ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How your earnings are calculated</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sale price</span>
              <span>100%</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Reswell marketplace fee</span>
              <span>−7%</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Buyer protection fund</span>
              <span>−2%</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Your earnings</span>
              <span>91%</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Card payments also include Stripe processing (~2.9% + $0.30). Earnings
              are held for 2 days then move to pending. After the 30-day buyer protection
              window closes, funds become available to cash out.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <PayoutModal
        open={payoutModalOpen}
        onOpenChange={setPayoutModalOpen}
        availableBalance={available}
        paymentMethods={paymentMethods}
        onSuccess={() => {
          setPayoutModalOpen(false)
          fetchData()
        }}
      />

      <AddPaymentMethodDialog
        open={addMethodOpen}
        onOpenChange={setAddMethodOpen}
        onAdded={(method) => {
          setPaymentMethods((prev) => {
            const updated = prev.map((m) =>
              method.is_default ? { ...m, is_default: false } : m
            )
            return [...updated, method]
          })
          setAddMethodOpen(false)
        }}
      />
    </div>
  )
}

// ─── Payout row ───────────────────────────────────────────────────────────────

function PayoutRow({ payout }: { payout: Payout }) {
  const [expanded, setExpanded] = useState(false)
  const amount = parseFloat(String(payout.amount))
  const netAmount = parseFloat(String(payout.net_amount))
  const fee = parseFloat(String(payout.fee))

  return (
    <>
      <div
        className="grid sm:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 sm:gap-4 px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Date */}
        <div>
          <p className="text-sm font-medium">
            {new Date(payout.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(payout.created_at).toLocaleDateString("en-US", { year: "numeric" })}
          </p>
        </div>

        {/* Amount */}
        <div className="text-right">
          <p className="font-semibold text-sm">${netAmount.toFixed(2)}</p>
          {fee > 0 && (
            <p className="text-xs text-muted-foreground">−${fee.toFixed(2)} fee</p>
          )}
        </div>

        {/* Method */}
        <div className="hidden sm:block">
          <Badge variant="outline" className="text-xs font-normal">
            {methodLabel(payout.method)}
          </Badge>
        </div>

        {/* Destination */}
        <div className="hidden sm:block">
          <p className="text-sm text-muted-foreground truncate max-w-[140px]">
            {payout.destination}
          </p>
        </div>

        {/* Status */}
        <div>
          <StatusBadge status={payout.status} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 bg-muted/20 text-sm space-y-1.5 border-b">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross amount</span>
            <span>${amount.toFixed(2)}</span>
          </div>
          {fee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee</span>
              <span className="text-amber-600">−${fee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>Net received</span>
            <span>${netAmount.toFixed(2)}</span>
          </div>
          {payout.estimated_arrival && payout.status !== "PAID" && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. arrival</span>
              <span>
                {new Date(payout.estimated_arrival).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
          {payout.failure_reason && (
            <div className="flex items-start gap-1.5 text-destructive mt-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{payout.failure_reason}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payout ID</span>
            <span className="font-mono text-xs">{payout.id.slice(0, 8)}…</span>
          </div>
        </div>
      )}
    </>
  )
}
