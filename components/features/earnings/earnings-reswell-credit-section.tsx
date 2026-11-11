"use client"

import { useCallback, useEffect, useState } from "react"
import { Gift, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getReswellCreditEarningsData,
  grantSelfAdminPilotReswellCredit,
} from "@/app/actions/reswell-credit"
import type { ReswellCreditActivityItem, ReswellCreditWalletSnapshot } from "@/lib/services/reswellCreditPilot"
import { cn } from "@/lib/utils"

function formatSignedUsd(type: ReswellCreditActivityItem["type"], amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  if (type === "earn" || type === "grant" || type === "release") return `+$${abs}`
  return `-$${abs}`
}

export function EarningsReswellCreditSection() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState<ReswellCreditWalletSnapshot | null>(null)
  const [activity, setActivity] = useState<ReswellCreditActivityItem[]>([])
  const [granting, setGranting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getReswellCreditEarningsData()
      if (res.error || !res.pilot) {
        setVisible(false)
        setWallet(null)
        setActivity([])
        return
      }
      setVisible(true)
      setWallet(res.pilot.wallet)
      setActivity(res.pilot.activity)
    } catch {
      setVisible(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function grantPilot() {
    if (granting) return
    setGranting(true)
    try {
      const res = await grantSelfAdminPilotReswellCredit(25)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Added $${res.amountUsd.toFixed(2)} Reswell Credit`)
      await load()
    } catch {
      toast.error("Could not grant Reswell Credit")
    } finally {
      setGranting(false)
    }
  }

  if (!loading && !visible) return null

  return (
    <section className="space-y-4" aria-labelledby="reswell-credit-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="reswell-credit-heading" className="text-base font-semibold text-foreground">
            Reswell Credit
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rewards for buying and selling on Reswell. Use on checkout — never cashable.
          </p>
        </div>
        {visible ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={granting || loading}
            onClick={() => void grantPilot()}
            className="gap-1.5"
          >
            {granting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
            Add $25 test credit
          </Button>
        ) : null}
      </div>

      {loading ? (
        <Card className="border-border/80">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="border-teal-700/20 bg-teal-950/[0.03] dark:bg-teal-950/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden />
                Reswell Credit balance
              </div>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">
                ${(wallet?.balanceUsd ?? 0).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Not redeemable for cash. Separate from Reswell Bucks (your cashable earnings above).
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm pt-1 border-t border-border/60">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-0.5">Lifetime earned</p>
                  <p className="font-semibold tabular-nums">${(wallet?.lifetimeEarnedUsd ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-0.5">Lifetime spent</p>
                  <p className="font-semibold tabular-nums">${(wallet?.lifetimeSpentUsd ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Credit activity</p>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No Reswell Credit yet. Complete a buy or sale, or add test credit.
                </p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activity.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-foreground">{row.description}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {new Date(row.createdAt).toLocaleString()}
                          {row.status !== "posted" ? ` · ${row.status}` : ""}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 font-semibold tabular-nums",
                          row.type === "earn" || row.type === "grant" || row.type === "release"
                            ? "text-teal-700 dark:text-teal-400"
                            : "text-foreground",
                        )}
                      >
                        {formatSignedUsd(row.type, row.amountUsd)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  )
}
