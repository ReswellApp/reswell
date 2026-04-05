"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"

/** Legacy Stripe return URL — card checkout is removed; keep route for bookmarks. */
export default function BoardCheckoutSuccessPage() {
  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-md">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-neutral-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-neutral-900" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Checkout updated</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Card payments are paused while we rebuild payments. Use{" "}
              <strong>Reswell Bucks</strong> from the board listing checkout flow instead.
            </p>
            <div className="flex flex-col gap-3">
              <Button asChild>
                <Link href="/dashboard/orders">Go to orders</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/boards">Browse surfboards</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
