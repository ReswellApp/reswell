"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && !cleared) {
      localStorage.removeItem("cart")
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      setCleared(true)
    }
  }, [cleared])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-16">
        <div className="container mx-auto px-4 max-w-md text-center">
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 p-4">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Order confirmed</h1>
              <p className="text-muted-foreground mb-6">
                Thanks for your purchase. Your order has been placed
                {orderId ? ` (Order #${orderId.slice(0, 8)})` : ""}.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild>
                  <Link href="/dashboard/orders">View my orders</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/shop">Continue shopping</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
