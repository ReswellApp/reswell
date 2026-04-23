"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw } from "lucide-react"
import { getEarningsWalletData, loadMoreEarningsActivity } from "@/app/actions/wallet"
import { EARNINGS_ACTIVITY_PAGE_SIZE } from "@/lib/earnings-activity-page-size"
import { EarningsLifetimeStats } from "@/components/features/earnings/earnings-lifetime-stats"
import { EarningsQuickReference } from "@/components/features/earnings/earnings-quick-reference"
import { EarningsActivity } from "@/components/features/earnings/earnings-activity"
import { EarningsStripePayoutCard } from "@/components/features/earnings/earnings-stripe-payout-card"
import { EarningsPaymentsOverview } from "@/components/features/earnings/earnings-payments-overview"
import { EarningsPayoutBalanceSection } from "@/components/features/earnings/earnings-payout-balance-section"
import type { StripeConnectStatusPayload } from "@/components/features/earnings/stripe-bank-payout-section"
import type { EarningsTransaction, EarningsWalletSnapshot } from "@/components/features/earnings/earnings-types"

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

export default function EarningsPage() {
  const [earningsTab, setEarningsTab] = useState("payments")
  const [wallet, setWallet] = useState<EarningsWalletSnapshot | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<EarningsTransaction[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityHasMore, setActivityHasMore] = useState(false)
  const [activityLoadMoreError, setActivityLoadMoreError] = useState<string | null>(null)
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false)

  const [reversedOrderIds, setReversedOrderIds] = useState<Set<string>>(() => new Set())
  const [refreshing, setRefreshing] = useState(false)

  const [stripeConnectStatus, setStripeConnectStatus] = useState<StripeConnectStatusPayload | null>(null)
  const [stripeTransferHistory, setStripeTransferHistory] = useState<StripeTransferHistoryItem[]>([])
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true)
  const [stripeHistoryLoading, setStripeHistoryLoading] = useState(true)
  const [stripeStatusFailed, setStripeStatusFailed] = useState(false)
  const [stripeHistoryFailed, setStripeHistoryFailed] = useState(false)

  const stripeCashOutWalletTrustRef = useRef<{
    balance: string
    lifetime_cashed_out: string
    expires: number
  } | null>(null)

  const fetchGenerationRef = useRef(0)
  const pendingBankScrollRef = useRef(false)
  const earningsResyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** First wallet+activity fetch only — later refetches update in place without skeleton flash. */
  const initialWalletActivityPaintRef = useRef(true)

  const stripePayoutsEnabled =
    typeof process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === "string" &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.trim().length > 0

  const fetchWalletBundle = useCallback(async (gen: number) => {
    const showSkeleton = initialWalletActivityPaintRef.current
    if (showSkeleton) {
      setWalletLoading(true)
      setActivityLoading(true)
    }
    setWalletError(null)
    try {
      const earningsData = await getEarningsWalletData({ activityLimit: EARNINGS_ACTIVITY_PAGE_SIZE })
      if (gen !== fetchGenerationRef.current) return

      if (!earningsData.error && earningsData.wallet) {
        let nextWallet = earningsData.wallet as EarningsWalletSnapshot
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
        setTransactions(earningsData.transactions as EarningsTransaction[])
        setReversedOrderIds(new Set(earningsData.reversedOrderIds ?? []))
        setActivityHasMore(Boolean(earningsData.activityHasMore))
      } else {
        setWallet(null)
        setWalletError(
          earningsData.error === "Unauthorized"
            ? "Sign in to view earnings."
            : "Could not load your wallet.",
        )
        setTransactions([])
        setReversedOrderIds(new Set())
        setActivityHasMore(false)
      }
    } catch {
      if (gen !== fetchGenerationRef.current) return
      setWalletError("Could not load your wallet.")
      setWallet(null)
      setTransactions([])
      setActivityHasMore(false)
    } finally {
      if (gen === fetchGenerationRef.current && showSkeleton) {
        setWalletLoading(false)
        setActivityLoading(false)
        initialWalletActivityPaintRef.current = false
      }
    }
  }, [])

  const fetchStripeData = useCallback(async (gen: number) => {
    if (!stripePayoutsEnabled) {
      setStripeStatusLoading(false)
      setStripeHistoryLoading(false)
      return
    }
    setStripeStatusLoading(true)
    setStripeHistoryLoading(true)
    setStripeStatusFailed(false)
    setStripeHistoryFailed(false)
    try {
      const [statusRes, payoutsRes] = await Promise.all([
        fetch("/api/stripe/connect/status", { cache: "no-store" }),
        fetch("/api/payouts/stripe", { cache: "no-store" }),
      ])
      if (gen !== fetchGenerationRef.current) return

      if (statusRes.ok) {
        const s = (await statusRes.json()) as StripeConnectStatusPayload
        setStripeConnectStatus(s)
      } else {
        setStripeConnectStatus(null)
        setStripeStatusFailed(true)
      }

      if (payoutsRes.ok) {
        const t = (await payoutsRes.json()) as { history?: StripeTransferHistoryItem[] }
        setStripeTransferHistory(t.history ?? [])
      } else {
        setStripeTransferHistory([])
        setStripeHistoryFailed(true)
      }
    } catch {
      if (gen !== fetchGenerationRef.current) return
      setStripeStatusFailed(true)
      setStripeHistoryFailed(true)
      setStripeConnectStatus(null)
      setStripeTransferHistory([])
    } finally {
      if (gen === fetchGenerationRef.current) {
        setStripeStatusLoading(false)
        setStripeHistoryLoading(false)
      }
    }
  }, [stripePayoutsEnabled])

  const fetchData = useCallback(
    async (opts?: { showRefreshIndicator?: boolean }) => {
      const gen = ++fetchGenerationRef.current
      if (opts?.showRefreshIndicator) setRefreshing(true)
      setActivityLoadMoreError(null)
      try {
        await Promise.all([fetchWalletBundle(gen), fetchStripeData(gen)])
      } finally {
        if (gen === fetchGenerationRef.current) {
          setRefreshing(false)
        }
      }
    },
    [fetchWalletBundle, fetchStripeData],
  )

  const scheduleEarningsResync = useCallback(() => {
    if (earningsResyncDebounceRef.current) {
      clearTimeout(earningsResyncDebounceRef.current)
    }
    earningsResyncDebounceRef.current = setTimeout(() => {
      earningsResyncDebounceRef.current = null
      void fetchData()
    }, 150)
  }, [fetchData])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (earningsTab !== "payments" || !pendingBankScrollRef.current) return
    pendingBankScrollRef.current = false
    const t = window.setTimeout(() => {
      document.getElementById("earnings-bank-payout")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
    return () => window.clearTimeout(t)
  }, [earningsTab])

  const openBankSetupFromPayoutTab = useCallback(() => {
    setEarningsTab("payments")
    pendingBankScrollRef.current = true
  }, [])

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
          scheduleEarningsResync()
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
          scheduleEarningsResync()
        },
      )
      .subscribe()
    return () => {
      if (earningsResyncDebounceRef.current) {
        clearTimeout(earningsResyncDebounceRef.current)
        earningsResyncDebounceRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [wallet?.id, scheduleEarningsResync])

  const handleStripeBankCashOutSettled = useCallback(
    (detail: {
      amountUsd: number
      availableBalanceAfter: number
      lifetimeCashedOutAfter: number
      speed: "standard" | "instant"
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

  const loadMoreActivity = useCallback(async () => {
    if (!wallet || loadingMoreActivity || !activityHasMore) return
    setLoadingMoreActivity(true)
    setActivityLoadMoreError(null)
    try {
      const res = await loadMoreEarningsActivity({
        offset: transactions.length,
        limit: EARNINGS_ACTIVITY_PAGE_SIZE,
      })
      if (res.error) {
        setActivityLoadMoreError(
          res.error === "Unauthorized" ? "Session expired — refresh the page." : "Could not load older activity.",
        )
        return
      }
      setTransactions((prev) => {
        const seen = new Set(prev.map((t) => t.id))
        const add = (res.transactions as EarningsTransaction[]).filter((t) => !seen.has(t.id))
        return [...prev, ...add]
      })
      setReversedOrderIds((prev) => {
        const next = new Set(prev)
        for (const id of res.reversedOrderIds) next.add(id)
        return next
      })
      setActivityHasMore(res.hasMore)
    } catch {
      setActivityLoadMoreError("Could not load older activity.")
    } finally {
      setLoadingMoreActivity(false)
    }
  }, [wallet, loadingMoreActivity, activityHasMore, transactions.length])

  /** Trim payout history back to the first page (drops extra rows loaded via Load more). */
  const collapseActivityToFirstPage = useCallback(() => {
    setTransactions((prev) => {
      if (prev.length <= EARNINGS_ACTIVITY_PAGE_SIZE) return prev
      const hadLoadedExtra = prev.length > EARNINGS_ACTIVITY_PAGE_SIZE
      queueMicrotask(() => {
        setActivityHasMore((more) => hadLoadedExtra || more)
      })
      return prev.slice(0, EARNINGS_ACTIVITY_PAGE_SIZE)
    })
  }, [])

  const displayAvailable = wallet ? parseFloat(wallet.balance) : 0
  const stripeBlockLoading = stripePayoutsEnabled && (stripeStatusLoading || stripeHistoryLoading)

  const payoutHistoryCaption = "A full record of money in and out—sales, refunds, purchases, and bank transfers."

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Earnings</h1>
          <p className="text-muted-foreground">Your marketplace wallet and payouts.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={() => void fetchData({ showRefreshIndicator: true })}
          className="text-muted-foreground shrink-0"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </Button>
      </div>

      <Tabs value={earningsTab} onValueChange={setEarningsTab} className="w-full">
        <TabsList
          className={cn(
            "w-full sm:w-auto h-auto p-0 bg-transparent rounded-none justify-start gap-8",
            "border-b border-border",
          )}
        >
          <TabsTrigger
            value="payments"
            className={cn(
              "rounded-none border-0 border-b-2 border-transparent px-0 pb-3 -mb-px bg-transparent shadow-none",
              "data-[state=active]:shadow-none data-[state=active]:bg-transparent",
              "data-[state=active]:border-foreground text-muted-foreground data-[state=active]:text-foreground",
            )}
          >
            Payments
          </TabsTrigger>
          <TabsTrigger
            value="balance"
            className={cn(
              "rounded-none border-0 border-b-2 border-transparent px-0 pb-3 -mb-px bg-transparent shadow-none",
              "data-[state=active]:shadow-none data-[state=active]:bg-transparent",
              "data-[state=active]:border-foreground text-muted-foreground data-[state=active]:text-foreground",
            )}
          >
            Payout balance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-6 space-y-8 focus-visible:outline-none">
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">Overview</h2>
            <EarningsPaymentsOverview
              wallet={wallet}
              transactions={transactions}
              isLoading={walletLoading}
              errorMessage={walletError}
              stripePayoutsEnabled={stripePayoutsEnabled}
              stripeLoading={stripePayoutsEnabled ? stripeBlockLoading : false}
              connectStatus={stripeConnectStatus}
              activityHasMore={activityHasMore}
            />
          </section>

          <EarningsLifetimeStats wallet={wallet} isLoading={walletLoading} />

          {stripePayoutsEnabled ? (
            <section id="earnings-bank-payout" className="scroll-mt-28 space-y-3">
              <h2 className="text-base font-semibold text-foreground">Bank transfers</h2>
              <EarningsStripePayoutCard
                enabled={stripePayoutsEnabled}
                isLoading={stripeBlockLoading}
                statusFetchFailed={stripeStatusFailed}
                historyFetchFailed={stripeHistoryFailed}
                onRetry={() => void fetchData()}
                availableBalance={displayAvailable}
                connectStatus={stripeConnectStatus}
                transferHistory={stripeTransferHistory}
                onRefresh={fetchData}
                onCashOutSettled={handleStripeBankCashOutSettled}
              />
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="balance" className="mt-6 space-y-8 focus-visible:outline-none">
          <EarningsPayoutBalanceSection
            wallet={wallet}
            isLoading={walletLoading}
            errorMessage={walletError}
            stripePayoutsEnabled={stripePayoutsEnabled}
            stripeLoading={stripePayoutsEnabled ? stripeBlockLoading : false}
            connectStatus={stripeConnectStatus}
            statusFetchFailed={stripeStatusFailed}
            onCompletePayoutDetails={openBankSetupFromPayoutTab}
          />
          <EarningsActivity
            transactions={transactions}
            reversedOrderIds={reversedOrderIds}
            hasMore={activityHasMore}
            isLoading={activityLoading}
            isLoadingMore={loadingMoreActivity}
            loadError={walletError}
            loadMoreError={activityLoadMoreError}
            onLoadMore={loadMoreActivity}
            onCollapseLoadedActivity={collapseActivityToFirstPage}
            heading="Payout history"
            caption={payoutHistoryCaption}
            globalEmptyCopy={{
              title: "You don’t have a payout history yet",
              body: "Here you’ll see a complete record of money coming in from sales and going out as payouts, refunds, and purchases.",
            }}
          />
          <EarningsQuickReference stripePayoutsEnabled={stripePayoutsEnabled} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
