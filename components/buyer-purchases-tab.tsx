"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Package, ChevronRight, Receipt } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"

type Row = {
  id: string
  amount: number | string
  created_at: string
  fulfillment_method: string | null
  stripe_checkout_session_id: string | null
  seller_id: string
  listings: {
    id: string
    title: string
    listing_images: Array<{ url: string; is_primary: boolean | null }> | null
  } | null
}

function primaryImage(images: Array<{ url: string; is_primary: boolean | null }> | null | undefined) {
  if (!images?.length) return null
  const primary = images.find((i) => i.is_primary)
  return (primary ?? images[0]).url
}

export function BuyerPurchasesTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data, error: qErr } = await supabase
      .from("purchases")
      .select(
        `
        id,
        amount,
        created_at,
        fulfillment_method,
        stripe_checkout_session_id,
        seller_id,
        listings ( id, title, listing_images ( url, is_primary ) )
      `
      )
      .eq("buyer_id", user.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })

    if (qErr) {
      setError(true)
      setRows([])
    } else {
      const normalized = (data ?? []).map((r) => {
        const raw = r as {
          listings:
            | Row["listings"]
            | NonNullable<Row["listings"]>[]
            | null
        }
        const listing = Array.isArray(raw.listings) ? raw.listings[0] : raw.listings
        return { ...(r as Omit<Row, "listings">), listings: listing ?? null }
      })
      setRows(normalized)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    // CLS-FIX: skeleton list reserves the same vertical space as the loaded
    // purchase rows, preventing the page from shifting when data arrives.
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
          <div className="h-8 w-28 rounded bg-muted animate-pulse" />
        </div>
        <ul className="space-y-2">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="h-12 w-12 flex-shrink-0 rounded-md bg-muted animate-pulse" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${50 + i * 12}%` }} />
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-5 w-5 rounded bg-muted animate-pulse shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load purchases. Ask your admin to run{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">scripts/031_purchases_select_as_buyer.sql</code>{" "}
        in Supabase.
      </p>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center space-y-4">
          <Receipt className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm max-w-sm">
            You have not bought anything from other members yet. When you do, it will show here and on
            the full purchases page.
          </p>
          <Button asChild variant="outline">
            <Link href="/gear">Browse gear</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Peer-to-peer buys (used gear, surfboards, Reswell Bucks or card).
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/purchases">Open full page</Link>
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => {
          const title = row.listings?.title
            ? capitalizeWords(row.listings.title)
            : "Item (listing removed)"
          const img = primaryImage(row.listings?.listing_images ?? null)
          const fulfill =
            row.fulfillment_method === "shipping"
              ? "Ship"
              : row.fulfillment_method === "pickup"
                ? "Pickup"
                : "—"

          return (
            <li key={row.id}>
              <Link
                href={`/dashboard/purchases/${row.id}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <div className="relative h-12 w-12 flex-shrink-0 rounded-md border bg-muted overflow-hidden">
                  {img ? (
                    <Image src={img} alt="" fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-muted-foreground">
                    #{row.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="font-medium text-foreground line-clamp-1">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}{" "}
                    · ${Number(row.amount).toFixed(2)} · {fulfill}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
