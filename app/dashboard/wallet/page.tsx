"use client"

import React from "react"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Banknote,
  AlertCircle,
} from "lucide-react"
import { getPayoutFee, getPayoutNetAmount, type PayoutType } from "@/lib/payout-fees"

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

interface CashoutRequest {
  id: string
  amount: string
  fee: string
  net_amount: string
  payment_method: string
  payment_email: string
  status: string
  created_at: string
}

const MIN_CASHOUT = 10

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pendingCashouts, setPendingCashouts] = useState<CashoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [cashoutOpen, setCashoutOpen] = useState(false)
  const [cashoutAmount, setCashoutAmount] = useState("")
  const [cashoutPayoutType, setCashoutPayoutType] = useState<PayoutType>("standard")
  const [cashoutMethod, setCashoutMethod] = useState("")
  const [cashoutEmail, setCashoutEmail] = useState("")
  const [cashoutLoading, setCashoutLoading] = useState(false)
  const [cashoutError, setCashoutError] = useState("")

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet")
      if (res.ok) {
        const data = await res.json()
        setWallet(data.wallet)
        setTransactions(data.transactions)
        setPendingCashouts(data.pendingCashouts)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  const handleCashout = async () => {
    setCashoutError("")
    setCashoutLoading(true)

    try {
      const res = await fetch("/api/wallet/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(cashoutAmount),
          payout_type: cashoutPayoutType,
          payment_method: cashoutMethod,
          payment_email: cashoutEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCashoutError(data.error || "Failed to process cash-out")
        return
      }

      setCashoutOpen(false)
      setCashoutAmount("")
      setCashoutPayoutType("standard")
      setCashoutMethod("")
      setCashoutEmail("")
      fetchWallet()
    } catch {
      setCashoutError("An unexpected error occurred")
    } finally {
      setCashoutLoading(false)
    }
  }

  const balance = wallet ? parseFloat(wallet.balance) : 0
  const earned = wallet ? parseFloat(wallet.lifetime_earned) : 0
  const spent = wallet ? parseFloat(wallet.lifetime_spent) : 0
  const cashedOut = wallet ? parseFloat(wallet.lifetime_cashed_out) : 0
  const cashoutAmountNum = parseFloat(cashoutAmount) || 0
  const cashoutFee = getPayoutFee(cashoutAmountNum, cashoutPayoutType)
  const cashoutNet = getPayoutNetAmount(cashoutAmountNum, cashoutPayoutType)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sale":
        return <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
      case "purchase":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />
      case "cashout":
        return <Banknote className="h-4 w-4 text-amber-500" />
      case "deposit":
        return <ArrowDownLeft className="h-4 w-4 text-blue-500" />
      case "refund":
        return <ArrowDownLeft className="h-4 w-4 text-purple-500" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sale": return "Sale"
      case "purchase": return "Purchase"
      case "cashout": return "Cash Out"
      case "deposit": return "Deposit"
      case "refund": return "Refund"
      default: return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case "processing":
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>
      case "failed":
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ReSwell Bucks</h1>
        <p className="text-muted-foreground">
          Your internal currency for buying and selling on the marketplace
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Wallet className="h-4 w-4" />
              Available Balance
            </div>
            <div className="text-3xl font-bold text-primary">
              R${balance.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              Lifetime Earned
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              R${earned.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <ArrowUpRight className="h-4 w-4" />
              Lifetime Spent
            </div>
            <div className="text-2xl font-bold">
              R${spent.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Banknote className="h-4 w-4" />
              Cashed Out
            </div>
            <div className="text-2xl font-bold">
              R${cashedOut.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Out Button */}
      <div className="flex gap-3">
        <Dialog open={cashoutOpen} onOpenChange={setCashoutOpen}>
          <DialogTrigger asChild>
            <Button size="lg" disabled={balance < MIN_CASHOUT}>
              <Banknote className="h-4 w-4 mr-2" />
              Cash Out to Real Currency
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cash Out ReSwell Bucks</DialogTitle>
              <DialogDescription>
                0% standard payout; 1% instant payout. Minimum R${MIN_CASHOUT}.00.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold text-primary">R${balance.toFixed(2)}</p>
              </div>

              <div className="space-y-2">
                <Label>Payout speed</Label>
                <Select value={cashoutPayoutType} onValueChange={(v: PayoutType) => setCashoutPayoutType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard — 0% fee</SelectItem>
                    <SelectItem value="instant">Instant — 1% fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cashout-amount">Amount to Cash Out</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    id="cashout-amount"
                    type="number"
                    step="0.01"
                    min={MIN_CASHOUT}
                    max={balance}
                    value={cashoutAmount}
                    onChange={(e) => setCashoutAmount(e.target.value)}
                    className="pl-9"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs p-0 h-auto"
                    onClick={() => setCashoutAmount(balance.toFixed(2))}
                  >
                    Cash out all
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={cashoutMethod} onValueChange={setCashoutMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payout method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="venmo">Venmo</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cashout-email">
                  {cashoutMethod === "venmo" ? "Venmo Username" : cashoutMethod === "bank_transfer" ? "Bank Email" : "PayPal Email"}
                </Label>
                <Input
                  id="cashout-email"
                  type={cashoutMethod === "venmo" ? "text" : "email"}
                  value={cashoutEmail}
                  onChange={(e) => setCashoutEmail(e.target.value)}
                  placeholder={cashoutMethod === "venmo" ? "@username" : "email@example.com"}
                />
              </div>

              {cashoutAmountNum >= MIN_CASHOUT && (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span>R${cashoutAmountNum.toFixed(2)}</span>
                  </div>
                  {cashoutFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee (1% instant)</span>
                      <span className="text-red-500">-R${cashoutFee.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>You receive</span>
                    <span className="text-emerald-600">${cashoutNet.toFixed(2)} USD</span>
                  </div>
                </div>
              )}

              {cashoutError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {cashoutError}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCashoutOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCashout}
                disabled={
                  cashoutLoading ||
                  cashoutAmountNum < MIN_CASHOUT ||
                  cashoutAmountNum > balance ||
                  !cashoutMethod ||
                  !cashoutEmail
                }
              >
                {cashoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Cash Out $${cashoutNet.toFixed(2)}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {balance < MIN_CASHOUT && balance > 0 && (
          <p className="text-sm text-muted-foreground self-center">
            You need at least R${MIN_CASHOUT}.00 to cash out
          </p>
        )}
      </div>

      {/* Pending Cash-outs */}
      {pendingCashouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Cash-outs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingCashouts.map((cashout) => (
                <div key={cashout.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">R${parseFloat(cashout.amount).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      via {cashout.payment_method} to {cashout.payment_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Payout: ${parseFloat(cashout.net_amount).toFixed(2)} (after R${parseFloat(cashout.fee).toFixed(2)} fee)
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(cashout.status)}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(cashout.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Tabs defaultValue="all">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Transaction History</h2>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="earned">Earned</TabsTrigger>
            <TabsTrigger value="spent">Spent</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all">
          <TransactionList transactions={transactions} getTypeIcon={getTypeIcon} getTypeLabel={getTypeLabel} getStatusBadge={getStatusBadge} />
        </TabsContent>
        <TabsContent value="earned">
          <TransactionList
            transactions={transactions.filter((t) => ["sale", "deposit", "refund"].includes(t.type))}
            getTypeIcon={getTypeIcon}
            getTypeLabel={getTypeLabel}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        <TabsContent value="spent">
          <TransactionList
            transactions={transactions.filter((t) => ["purchase", "cashout"].includes(t.type))}
            getTypeIcon={getTypeIcon}
            getTypeLabel={getTypeLabel}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
      </Tabs>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How ReSwell Bucks Work</CardTitle>
          <CardDescription>Your guide to the ReSwell Surf marketplace currency</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                </div>
                Earn
              </div>
              <p className="text-sm text-muted-foreground">
                When you sell used gear on ReSwell Surf, the buyer pays and funds go to your wallet. Standard fees: 5% marketplace fee; card sales also include payment processing (~2.9% + $0.30).
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </div>
                Spend
              </div>
              <p className="text-sm text-muted-foreground">
                Use your ReSwell bucks to purchase used gear, surfboards, and more from other sellers on the marketplace.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-amber-500" />
                </div>
                Cash Out
              </div>
              <p className="text-sm text-muted-foreground">
                Cash out to real currency via PayPal, Venmo, or bank transfer. 0% standard payout; 1% instant payout. Minimum R$10.00.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TransactionList({
  transactions,
  getTypeIcon,
  getTypeLabel,
  getStatusBadge,
}: {
  transactions: Transaction[]
  getTypeIcon: (type: string) => React.ReactNode
  getTypeLabel: (type: string) => string
  getStatusBadge: (status: string) => React.ReactNode
}) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No transactions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your transactions will appear here when you buy or sell items.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {transactions.map((tx) => {
            const amount = parseFloat(tx.amount)
            const isPositive = amount > 0
            return (
              <div key={tx.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    {getTypeIcon(tx.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{getTypeLabel(tx.type)}</span>
                      {getStatusBadge(tx.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[300px] truncate">
                      {tx.description}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${isPositive ? "text-emerald-600" : "text-foreground"}`}>
                    {isPositive ? "+" : ""}R${Math.abs(amount).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString()}
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
