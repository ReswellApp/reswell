"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react"

interface CartItem {
  id: string
  name: string
  price: number
  image_url: string | null
  quantity: number
}

export default function CheckoutPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null)
      const stored = JSON.parse(localStorage.getItem("cart") || "[]")
      setCart(stored)
      setLoading(false)
    })
  }, [])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = subtotal >= 50 ? 0 : 9.99
  const total = subtotal + shipping

  async function handlePay() {
    if (cart.length === 0) {
      toast.error("Your cart is empty")
      return
    }
    setPaying(true)
    try {
      const res = await fetch("/api/checkout/cart-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === "stripe_not_configured") {
          toast.error(
            process.env.NODE_ENV === "development"
              ? "Add STRIPE_SECRET_KEY to .env.local and restart the dev server."
              : "Card checkout is not available. Try again later or contact support."
          )
        } else {
          toast.error(data.error || "Checkout failed")
        }
        setPaying(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      toast.error("No checkout URL returned")
    } catch {
      toast.error("Checkout failed")
    }
    setPaying(false)
  }

  if (loading) {
    return (
        <main className="flex flex-1 items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
    )
  }

  if (!user) {
    return (
        <main className="flex-1 py-8">
          <div className="container mx-auto text-center">
            <p className="text-muted-foreground mb-4">Please sign in to checkout.</p>
            <Button asChild>
              <Link href="/login?redirect=/shop/checkout">Sign in</Link>
            </Button>
          </div>
        </main>
    )
  }

  if (cart.length === 0) {
    return (
        <main className="flex-1 py-8">
          <div className="container mx-auto text-center">
            <p className="text-muted-foreground mb-4">Your cart is empty.</p>
            <Button asChild>
              <Link href="/shop">Continue Shopping</Link>
            </Button>
          </div>
        </main>
    )
  }

  return (
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/shop/cart"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold">Checkout</h1>
          </div>

          <div className="space-y-4 mb-8">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 items-center p-3 rounded-lg border bg-card"
              >
                <div className="relative w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      className="object-contain"
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                      No Image
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-2">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    ${item.price.toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {shipping === 0 ? (
                    <span className="text-green-600">Free</span>
                  ) : (
                    `$${shipping.toFixed(2)}`
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handlePay}
                disabled={paying}
              >
                {paying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Pay with Card
              </Button>
              <Button variant="outline" className="w-full bg-transparent" asChild>
                <Link href="/shop/cart">Back to Cart</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
  )
}
