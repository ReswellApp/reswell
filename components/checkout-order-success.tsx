"use client"

import { useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import confetti from "canvas-confetti"
import { motion } from "motion/react"
import { ArrowRight, Check, Package, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"

export type CheckoutOrderSuccessPayload = {
  orderId: string
  displayNumber: string
  buyerEmail: string | null
  total: number
  itemPrice: number
  shippingCost: number
  fulfillmentMethod: "shipping" | "pickup" | null
  listing: {
    title: string
    imageUrl: string | null
    subtitle: string | null
    categoryLabel?: string | null
  } | null
  shipping: {
    oneLine: string | null
    name: string | null
    addressLines: string[] | null
    email: string | null
  } | null
}

function money(n: number) {
  return `$${n.toFixed(2)}`
}

function subcopy(fulfillment: CheckoutOrderSuccessPayload["fulfillmentMethod"]) {
  if (fulfillment === "pickup") {
    return "Stoke is high. Coordinate pickup with your seller."
  }
  return "Stoke is on the way. Your board ships out soon."
}

/** Port of `Downloads/Success page design/src/app/App.tsx` — cyan hero, motion, confetti, two-column card. */
export function CheckoutOrderSuccess({ data }: { data: CheckoutOrderSuccessPayload }) {
  useEffect(() => {
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()
      if (timeLeft <= 0) {
        clearInterval(interval)
        return
      }
      const particleCount = 50 * (timeLeft / duration)
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ["#06b6d4", "#0891b2", "#0e7490", "#155e75"],
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ["#06b6d4", "#0891b2", "#0e7490", "#155e75"],
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  const fulfill = data.fulfillmentMethod
  const shippingTitle =
    fulfill === "shipping" ? "Standard shipping" : fulfill === "pickup" ? "Local pickup" : "Delivery"
  const shippingBody =
    fulfill === "shipping" && data.shipping?.oneLine
      ? data.shipping.oneLine
      : fulfill === "pickup"
        ? "Coordinate time and place with the seller via Messages."
        : "Details are available on your order page."
  const shippingHint =
    fulfill === "shipping"
      ? "Seller will add tracking from your orders page when it ships."
      : fulfill === "pickup"
        ? "Bring your pickup code when you meet the seller."
        : null

  const category = data.listing?.categoryLabel?.trim() || "Order"

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-cyan-50 to-white dark:from-cyan-950/30 dark:to-background">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.05] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1556316782-1ec9b261c156?auto=format&fit=max&w=1080&q=80')",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-6 py-16 md:py-24">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className="mb-8 flex items-center justify-center"
        >
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600">
              <Check className="h-12 w-12 text-white" strokeWidth={3} />
            </div>
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              className="absolute inset-0 rounded-full bg-cyan-500/20"
              aria-hidden
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-16 text-center"
        >
          <h1 className="mb-4 bg-gradient-to-r from-cyan-700 to-cyan-900 bg-clip-text text-5xl tracking-tight text-transparent md:text-7xl dark:from-cyan-400 dark:to-cyan-200">
            Order Confirmed
          </h1>
          <p className="mx-auto max-w-xl text-xl text-foreground/60">{subcopy(fulfill)}</p>
        </motion.div>

        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8 overflow-hidden rounded-2xl border border-border/50 bg-white/80 shadow-xl shadow-cyan-500/5 backdrop-blur-sm dark:bg-card/80"
        >
          <div className="grid gap-8 p-8 md:grid-cols-2">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-950/50 dark:to-blue-950/40">
              {data.listing?.imageUrl ? (
                <Image
                  src={data.listing.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Package className="h-20 w-20 opacity-40" />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center">
              <div className="mb-6">
                <div className="mb-2 text-sm text-cyan-600 dark:text-cyan-400">{category}</div>
                <h2 className="mb-2 text-3xl font-semibold tracking-tight">
                  {data.listing?.title ?? "Your item"}
                </h2>
                {data.listing?.subtitle ? (
                  <div className="mb-4 text-muted-foreground">{data.listing.subtitle}</div>
                ) : null}
                <div className="text-2xl font-medium tabular-nums">{money(data.total)}</div>
              </div>

              <div className="space-y-4 border-t border-border/50 pt-6">
                <div className="flex items-start gap-3">
                  <Package className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                  <div>
                    <div className="mb-1 text-sm">Order number</div>
                    <div className="font-mono text-sm text-muted-foreground">{data.displayNumber}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                  <div>
                    <div className="mb-1 text-sm">{shippingTitle}</div>
                    <div className="text-sm text-muted-foreground">{shippingBody}</div>
                    {shippingHint ? (
                      <div className="mt-1 text-xs text-cyan-600 dark:text-cyan-400">{shippingHint}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col justify-center gap-4 sm:flex-row"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] hover:from-cyan-700 hover:to-cyan-800 hover:shadow-xl hover:shadow-cyan-500/30 dark:from-cyan-500 dark:to-cyan-600 dark:hover:from-cyan-600 dark:hover:to-cyan-700"
            asChild
          >
            <Link href="/dashboard/orders" className="gap-2">
              Track order
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-cyan-200 transition-all hover:scale-[1.02] hover:border-cyan-300 hover:bg-cyan-50 dark:border-cyan-800 dark:hover:bg-cyan-950/40"
            asChild
          >
            <Link href="/boards">Continue shopping</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 space-y-2 text-center text-sm text-muted-foreground"
        >
          <p>
            {data.buyerEmail
              ? `Order confirmation sent to ${data.buyerEmail}`
              : "Order confirmation sent to your email"}
          </p>
          <Link
            href={`/dashboard/orders/${data.orderId}`}
            className="text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-400"
          >
            View order details
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
