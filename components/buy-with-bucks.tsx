"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Wallet, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

interface BuyWithBucksProps {
  listingId: string
  listingTitle: string
  price: number
  sellerId: string
}

export function BuyWithBucks({ listingId, listingTitle, price, sellerId }: BuyWithBucksProps) {
  const [open, setOpen] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchingBalance, setFetchingBalance] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setFetchingBalance(true)
      setError("")
      setSuccess(false)
      fetch("/api/wallet")
        .then((res) => {
          if (!res.ok) throw new Error("Not authenticated")
          return res.json()
        })
        .then((data) => setBalance(parseFloat(data.wallet?.balance || "0")))
        .catch(() => setBalance(-1)) // -1 signals not logged in
        .finally(() => setFetchingBalance(false))
    }
  }, [open])

  const platformFee = Math.round(price * 5) / 100
  const sellerGets = price - platformFee
  const canAfford = balance !== null && balance >= price

  const handlePurchase = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/wallet/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Purchase failed")
        return
      }

      setSuccess(true)
      setBalance(data.newBalance)
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full gap-2">
          <Wallet className="h-4 w-4" />
          Buy with reswell Bucks - R${price.toFixed(2)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                Purchase Complete
              </DialogTitle>
              <DialogDescription>
                You have successfully purchased &quot;{listingTitle}&quot;
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                <p className="text-sm text-muted-foreground">Amount Paid</p>
                <p className="text-xl font-bold">R${price.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">
                  Remaining balance: R${(balance ?? 0).toFixed(2)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                The seller has been notified. You can coordinate pickup or shipping through messages.
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" asChild>
                <Link href="/dashboard/wallet">View Wallet</Link>
              </Button>
              <Button asChild>
                <Link href={`/messages`}>
                  Message Seller
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Purchase</DialogTitle>
              <DialogDescription>
                Buy &quot;{listingTitle}&quot; with reswell Bucks
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {fetchingBalance ? (
                <div className="flex items-center justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : balance === -1 ? (
                <div className="text-center space-y-3 p-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="font-medium">Sign in required</p>
                  <p className="text-sm text-muted-foreground">
                    You need to sign in to purchase items with reswell Bucks.
                  </p>
                  <Button asChild>
                    <Link href="/auth/login">Sign In</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="rounded-lg bg-muted/50 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Your Balance</p>
                      <p className="text-xl font-bold text-primary">R${(balance ?? 0).toFixed(2)}</p>
                    </div>
                    {canAfford ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Sufficient
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Insufficient
                      </Badge>
                    )}
                  </div>

                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Item Price</span>
                      <span>R${price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee (5%)</span>
                      <span className="text-muted-foreground">R${platformFee.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-sm">
                      <span className="text-muted-foreground">Seller receives</span>
                      <span>R${sellerGets.toFixed(2)}</span>
                    </div>
                  </div>

                  {!canAfford && (
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p>
                        You need R${(price - (balance ?? 0)).toFixed(2)} more. Earn reswell Bucks by selling items on the marketplace.
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>

            {balance !== -1 && !fetchingBalance && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePurchase} disabled={!canAfford || loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Pay R$${price.toFixed(2)}`
                  )}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
