"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { Wallet } from "lucide-react"

type WalletBalanceRow = {
  userId: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: string
  balance: number
  pendingBalance: number
  totalBalance: number
  lifetime_earned: number
  lifetime_spent: number
  lifetime_cashed_out: number
  inWalletOwed: number
  walletId: string | null
}

function formatBucks(n: number) {
  return `$${n.toFixed(2)}`
}

export default function AdminWalletBalancesPage() {
  const [rows, setRows] = useState<WalletBalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch("/api/admin/wallet-balances", { method: "GET" })
        const body = (await res.json()) as { data?: WalletBalanceRow[]; error?: string }
        if (!res.ok) {
          throw new Error(body.error || "Could not load wallet balances")
        }
        if (!cancelled) {
          setRows(body.data ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Could not load wallet balances")
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => b.totalBalance - a.totalBalance)
  }, [rows])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(
      (r) =>
        r.email?.toLowerCase().includes(q) ||
        (r.displayName?.toLowerCase().includes(q) ?? false),
    )
  }, [sorted, searchQuery])

  const nonZeroCount = useMemo(() => rows.filter((r) => r.totalBalance > 0.005).length, [rows])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Wallet balances</h1>
        <p className="text-muted-foreground">
          Reconciled in-wallet totals for every profile (admin only). Non-zero wallets:{" "}
          <span className="tabular-nums text-foreground">{nonZeroCount}</span>
        </p>
      </div>

      <SiteSearchBar
        className="max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={siteSearchInputClassName()}
        />
      </SiteSearchBar>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Wallet className="mx-auto mb-2 h-8 w-8 animate-pulse text-muted-foreground" />
              <p className="text-muted-foreground">Loading wallet balances…</p>
            </div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="text-destructive">{loadError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Wallet className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {rows.length === 0 ? "No users found." : "No rows match your search."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Total in wallet</TableHead>
                    <TableHead className="text-right">Owed</TableHead>
                    <TableHead className="text-right">Lifetime earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.userId}>
                      <TableCell>
                        <Link
                          href={`/admin/users/${r.userId}`}
                          className="flex items-center gap-3 hover:opacity-90"
                        >
                          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                            {r.avatarUrl ? (
                              <Image
                                src={r.avatarUrl || "/placeholder.svg"}
                                alt=""
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground">
                                {r.displayName?.[0]?.toUpperCase() ?? "?"}
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-foreground hover:text-primary">
                            {r.displayName || "—"}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBucks(r.balance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBucks(r.pendingBalance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatBucks(r.totalBalance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.inWalletOwed > 0 ? formatBucks(r.inWalletOwed) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatBucks(r.lifetime_earned)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
