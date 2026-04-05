"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"

/** Legacy shop cart success URL — Stripe cart checkout removed. */
export default function CheckoutSuccessPage() {
  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-md text-center">
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-neutral-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-neutral-900" />
              </div>
            </div>
            <h1 className="text-xl font-bold mb-2">Checkout updated</h1>
            <p className="text-muted-foreground text-sm mb-6">
              The old cart flow is no longer available. Use Reswell Bucks on each listing to buy from other
              members.
            </p>
            <div className="flex flex-col gap-3">
              <Button asChild>
                <Link href="/dashboard/orders">View orders</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/gear">Browse gear</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
