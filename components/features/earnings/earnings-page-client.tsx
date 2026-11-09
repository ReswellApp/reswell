"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getEarningsWalletData, loadMoreEarningsActivity } from "@/app/actions/wallet"
import { getReswellCreditEarningsData } from "@/app/actions/reswell-credit"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  EarningsActivityPane,
  EarningsAvailablePane,
  EarningsCreditPane,
  EarningsPendingPane,
} from "@/components/features/earnings/earnings-panes"
import { EarningsHub, EarningsHubSkeleton } from "@/components/features/earnings/earnings-hub"
import { EarningsStripePayoutCard } from "@/components/features/earnings/earnings-stripe-payout-card"
import type { EarningsTransaction, EarningsWalletSnapshot } from "@/components/features/earnings/earnings-types"
import type { EarningsBalanceListingRow } from "@/lib/earnings-balance-listings"
import { EARNINGS_ACTIVITY_PAGE_SIZE } from "@/lib/earnings-activity-page-size"
import { parseEarningsView } from "@/lib/earnings-view"
import { dispatchHeaderWalletSync } from "@/lib/auth/header-wallet-sync"
import type { SellerEarningsDashboardTotals } from "@/lib/db/sellerEarningsTotals"
import { formatUsd } from "@/lib/utils/format-usd"
import { createClient } from "@/lib/supabase/client"
import type { StripeConnectStatusPayload } from "@/lib/utils/stripe-connect-status"

interface StripeTransferHistoryItem {
  id: string
  amount: string | number
  fee_amount?: string | number | null
  payout_speed?: string | null
  stripe_transfer_id: string | null
  stripe_payout_id?: string | null
  status: string
  bank_payout_status?: string | null
  expected_arrival_at?: string | null
  created_at: string
}

function parseUsd(value: string | number | null | undefined): number {
  const amount = typeof value === "number" ? value : parseFloat(String(value ?? "0"))
  return Number.isFinite(amount) ? amount : 0
}

export function EarningsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = parseEarningsView(searchParams.get("view"))

  useEffect(() => {
    if (view) return
    if (window.location.hash !== "#earnings-bank-payout") return
    router.replace("/dashboard/earnings?view=available#earnings-bank-payout")
  }, [router, view])

  const [wallet, setWallet] = useState<EarningsWalletSnapshot | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<EarningsTransaction[]>([])
  const [pendingBalanceListings, setPendingBalanceListings] = useState<EarningsBalanceListingRow[]>([])
  const [readyBalanceListings, setReadyBalanceListings] = useState<EarningsBalanceListingRow[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityHasMore, setActivityHasMore] = useState(false)
  const [activityLoadMoreError, setActivityLoadMoreError] = useState<string | null>(null)
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false)

  const [reversedOrderIds, setReversedOrderIds] = useState<Set<string>>(() => new Set())

  const [stripeConnectStatus, setStripeConnectStatus] = useState<StripeConnectStatusPayload | null>(null)
  const [stripeTransferHistory, setStripeTransferHistory] = useState<StripeTransferHistoryItem[]>([])
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true)
  const [stripeHistoryLoading, setStripeHistoryLoading] = useState(true)
  const [stripeStatusFailed, setStripeStatusFailed] = useState(false)
  const [stripeHistoryFailed, setStripeHistoryFailed] = useState(false)

  const [sellerEarningsTotals, setSellerEarningsTotals] = useState<SellerEarningsDashboardTotals | null>(null)
  const [creditBalanceUsd, setCreditBalanceUsd] = useState(0)

  const stripeCashOutWalletTrustRef = useRef<{
    balance: string
    lifetime_cashed_out: string
    expires: number
  } | null>(null)

  const fetchGenerationRef = useRef(0)
  const earningsResyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      const [earningsData, creditData] = await Promise.all([
        getEarningsWalletData({ activityLimit: EARNINGS_ACTIVITY_PAGE_SIZE }),
        getReswellCreditEarningsData().catch(() => ({ error: "failed" as const, pilot: null })),
      ])
      if (gen !== fetchGenerationRef.current) return

      setCreditBalanceUsd(creditData.pilot?.wallet.balanceUsd ?? 0)

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
        dispatchHeaderWalletSync(nextWallet)
        setTransactions(earningsData.transactions as EarningsTransaction[])
        setPendingBalanceListings(earningsData.pendingBalanceListings ?? [])
        setReadyBalanceListings(earningsData.readyBalanceListings ?? [])
        setReversedOrderIds(new Set(earningsData.reversedOrderIds ?? []))
        setActivityHasMore(Boolean(earningsData.activityHasMore))
        setSellerEarningsTotals(earningsData.sellerEarningsTotals ?? null)
      } else {
        setWallet(null)
        setWalletError(
          earningsData.error === "Unauthorized"
            ? "Sign in to view earnings."
            : "Could not load your wallet.",
        )
        setTransactions([])
        setPendingBalanceListings([])
        setReadyBalanceListings([])
        setReversedOrderIds(new Set())
        setActivityHasMore(false)
        setSellerEarningsTotals(null)
      }
    } catch {
      if (gen !== fetchGenerationRef.current) return
      setWalletError("Could not load your wallet.")
      setWallet(null)
      setTransactions([])
      setPendingBalanceListings([])
      setReadyBalanceListings([])
      setActivityHasMore(false)
      setSellerEarningsTotals(null)
    } finally {
      if (gen === fetchGenerationRef.current && showSkeleton) {
        setWalletLoading(false)
        setActivityLoading(false)
        initialWalletActivityPaintRef.current = false
      }
    }
  }, [])

  const fetchStripeData = useCallback(
    async (gen: number) => {
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
    },
    [stripePayoutsEnabled],
  )

  const fetchData = useCallback(async () => {
    const gen = ++fetchGenerationRef.current
    setActivityLoadMoreError(null)
    await Promise.all([fetchWalletBundle(gen), fetchStripeData(gen)])
  }, [fetchWalletBundle, fetchStripeData])

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
      setWallet((w) => {
        if (!w) return w
        const next = { ...w, balance, lifetime_cashed_out }
        dispatchHeaderWalletSync(next)
        return next
      })
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

  const displayAvailable = wallet ? parseUsd(wallet.balance) : 0
  const displayPending = wallet ? parseUsd(wallet.pending_balance) : 0
  const lifetimeEarned = sellerEarningsTotals
    ? sellerEarningsTotals.lifetimeSoldUsd
    : wallet
      ? parseUsd(wallet.lifetime_earned)
      : 0
  const last30 = sellerEarningsTotals?.earnedLast30dUsd ?? 0
  const stripeBlockLoading = stripePayoutsEnabled && (stripeStatusLoading || stripeHistoryLoading)

  if (walletLoading && !wallet) {
    return <EarningsHubSkeleton />
  }

  if (walletError || !wallet) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load earnings</AlertTitle>
        <AlertDescription>{walletError ?? "Something went wrong. Try refresh."}</AlertDescription>
      </Alert>
    )
  }

  if (view === "pending") {
    return <EarningsPendingPane amountLabel={formatUsd(displayPending)} rows={pendingBalanceListings} />
  }

  if (view === "available") {
    return (
      <EarningsAvailablePane
        amountLabel={formatUsd(displayAvailable)}
        rows={readyBalanceListings}
        showTransfer={stripePayoutsEnabled}
        payout={
          stripePayoutsEnabled ? (
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
          ) : null
        }
      />
    )
  }

  if (view === "activity") {
    return (
      <EarningsActivityPane
        transactions={transactions}
        reversedOrderIds={reversedOrderIds}
        hasMore={activityHasMore}
        isLoading={activityLoading}
        isLoadingMore={loadingMoreActivity}
        loadError={walletError}
        loadMoreError={activityLoadMoreError}
        onLoadMore={loadMoreActivity}
        onCollapseLoadedActivity={collapseActivityToFirstPage}
      />
    )
  }

  if (view === "credit") {
    return <EarningsCreditPane />
  }

  return (
    <EarningsHub
      lifetimeLabel={formatUsd(lifetimeEarned)}
      last30Label={formatUsd(last30)}
      availableLabel={formatUsd(displayAvailable)}
      pendingLabel={formatUsd(displayPending)}
      readyLabel={formatUsd(displayAvailable)}
      creditLabel={formatUsd(creditBalanceUsd)}
    />
  )
}
