"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, ShoppingBag, TestTubeDiagonal } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ListingPreview = {
  id: string
  title: string
  slug: string | null
  sellerId: string
  status: string
  itemPrice: number
  shippingPrice: number
  pickupAvailable: boolean
  shippingAvailable: boolean
  suggestedFulfillment: "pickup" | "shipping"
}

type CreateResult = {
  orderId: string
  successPagePath: string
  amount: number
  fulfillmentMethod: "pickup" | "shipping"
}

function money(value: number) {
  return `$${value.toFixed(2)}`
}

export function AdminTestPurchaseClient() {
  const [listingRef, setListingRef] = useState("")
  const [fulfillment, setFulfillment] = useState<"pickup" | "shipping">("pickup")
  const [preview, setPreview] = useState<ListingPreview | null>(null)
  const [result, setResult] = useState<CreateResult | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)

  const needsFulfillmentChoice = Boolean(
    preview?.pickupAvailable && preview?.shippingAvailable,
  )

  async function handlePreview() {
    const trimmed = listingRef.trim()
    if (!trimmed) {
      toast.error("Enter a listing UUID, slug, or gear URL")
      return
    }

    setPreviewBusy(true)
    setResult(null)
    try {
      const params = new URLSearchParams({ listing_ref: trimmed })
      const res = await fetch(`/api/admin/test-purchase?${params}`)
      const body = (await res.json()) as { data?: ListingPreview; error?: string }
      if (!res.ok || !body.data) {
        toast.error(body.error ?? "Could not load listing")
        setPreview(null)
        return
      }
      setPreview(body.data)
      setFulfillment(body.data.suggestedFulfillment)
      toast.success("Listing loaded")
    } catch {
      toast.error("Could not load listing")
      setPreview(null)
    } finally {
      setPreviewBusy(false)
    }
  }

  async function handleCreate() {
    const trimmed = listingRef.trim()
    if (!trimmed) {
      toast.error("Enter a listing first")
      return
    }

    setCreateBusy(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/test-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_ref: trimmed,
          ...(needsFulfillmentChoice ? { fulfillment } : {}),
        }),
      })
      const body = (await res.json()) as { data?: CreateResult; error?: string }
      if (!res.ok || !body.data) {
        toast.error(body.error ?? "Could not create test purchase")
        return
      }
      setResult(body.data)
      toast.success("Test purchase created")
    } catch {
      toast.error("Could not create test purchase")
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Test purchase</h1>
        <p className="text-muted-foreground max-w-2xl">
          Seed a confirmed order for your signed-in admin account without Stripe or wallet charges.
          Use this to open the purchase success page and fire Google Ads purchase conversions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TestTubeDiagonal className="h-5 w-5" />
            Seed purchase
          </CardTitle>
          <CardDescription>
            Buyer is always your current admin account. The listing stays active — nothing is marked sold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listing-ref">Listing</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="listing-ref"
                placeholder="UUID, slug, or https://reswell.app/gear/…"
                value={listingRef}
                onChange={(e) => {
                  setListingRef(e.target.value)
                  setPreview(null)
                  setResult(null)
                }}
              />
              <Button type="button" variant="secondary" disabled={previewBusy} onClick={() => void handlePreview()}>
                {previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview listing"}
              </Button>
            </div>
          </div>

          {preview ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{preview.title}</p>
                <Badge variant="outline">{preview.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Item {money(preview.itemPrice)}
                {preview.shippingAvailable ? ` · Shipping ${money(preview.shippingPrice)}` : null}
              </p>
              <p className="text-xs font-mono text-muted-foreground break-all">{preview.id}</p>

              {needsFulfillmentChoice ? (
                <div className="space-y-2 max-w-xs">
                  <Label>Fulfillment</Label>
                  <Select
                    value={fulfillment}
                    onValueChange={(value: "pickup" | "shipping") => setFulfillment(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Pickup</SelectItem>
                      <SelectItem value="shipping">Shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Fulfillment: {preview.suggestedFulfillment}
                </p>
              )}
            </div>
          ) : null}

          <Button type="button" disabled={createBusy || !listingRef.trim()} onClick={() => void handleCreate()}>
            {createBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" />
                Create test purchase
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test order ready</CardTitle>
            <CardDescription>
              Open the success page while signed in as the buyer to trigger the Google purchase conversion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Order total: <span className="font-medium tabular-nums">{money(result.amount)}</span>
              {" · "}
              {result.fulfillmentMethod}
            </p>
            <p className="text-xs font-mono text-muted-foreground break-all">{result.orderId}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={result.successPagePath} target="_blank" rel="noreferrer">
                  Open success page
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/admin/orders/${result.orderId}`}>View in admin</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Ads conversion</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Purchase conversions only fire when these Vercel env vars are set and the app is redeployed:
          </p>
          <ul className="list-disc pl-5 space-y-1 font-mono text-xs">
            <li>NEXT_PUBLIC_GOOGLE_ADS_ID=AW-18062254229</li>
            <li>NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION=AW-18062254229/FsjrCPnlwbAcEJXB4KRD</li>
          </ul>
          <p>
            After deploy, use Tag Assistant on the success page URL while signed in as the buyer.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What this does</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Creates a confirmed order row with a fake Stripe reference (`admin_test_…`).</p>
          <p>Does not charge Stripe, debit wallets, mark the listing sold, or send Klaviyo events.</p>
          <p>A held seller payout row is still created by the database trigger — treat these as QA orders only.</p>
        </CardContent>
      </Card>
    </div>
  )
}
