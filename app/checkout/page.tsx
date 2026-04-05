"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/** Legacy shop cart checkout — removed. */
export default function CheckoutPage() {
  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-md">
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <h1 className="text-xl font-bold">Checkout moved</h1>
            <p className="text-sm text-muted-foreground">
              The old cart checkout is no longer available. Browse the marketplace and pay with Reswell Bucks
              from each listing.
            </p>
            <Button asChild>
              <Link href="/gear">Browse gear</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
