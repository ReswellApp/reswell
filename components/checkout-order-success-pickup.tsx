"use client"

import { useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import confetti from "canvas-confetti"
import { motion } from "motion/react"
import { ArrowRight, Check, MessageSquare, Package, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CheckoutOrderSuccessPayload } from "@/components/checkout-order-success"
import {
  formatPeerItemCountPhrase,
  formatPeerPossessiveItemPhrase,
} from "@/lib/peer-listing-item-nouns"
import {
  pickupCodeBannerLabelClassName,
  pickupCodeBannerSurfaceClassName,
} from "@/components/order-actions"

function money(n: number) {
  return `$${n.toFixed(2)}`
}

/**
 * Purchase confirmation for local pickup.
 * Mirrors `CheckoutOrderSuccess` styling but surfaces the buyer's pickup code
 * (shown to the seller at handoff) and a direct Messages link.
 */
export function CheckoutOrderSuccessPickup({ data }: { data: CheckoutOrderSuccessPayload }) {
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
    const colors = ["#04070E", "#475569", "#94a3b8", "#cbd5e1", "#059669"]

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
        colors,
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors,
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  const lines = data.orderLines
  const head = lines[0]
  const category = head?.categoryLabel?.trim() || "Order"
  const lineSections = lines.map((line) => line.section)
  const multiItemHeading = formatPeerItemCountPhrase(lines.length, lineSections)
  const pickupTargetPhrase =
    lines.length > 1
      ? `all ${formatPeerItemCountPhrase(lines.length, lineSections)}`
      : formatPeerPossessiveItemPhrase(1, lineSections)

  const messagesHref =
    data.sellerId && data.listingId
      ? `/messages/new?user=${encodeURIComponent(data.sellerId)}&listing=${encodeURIComponent(data.listingId)}`
      : null

  return (
    <main className="relative flex-1 overflow-hidden bg-background">
      <div className="relative mx-auto max-w-4xl px-6 py-12 md:py-20">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className="mb-8 flex items-center justify-center"
        >
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-foreground text-primary-foreground shadow-sm dark:bg-white dark:text-black">
              <Check className="h-12 w-12" strokeWidth={3} aria-hidden />
            </div>
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              className="absolute inset-0 rounded-full ring-2 ring-foreground/10 dark:ring-white/15"
              aria-hidden
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-12 text-center md:mb-16"
        >
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            Order confirmed
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground md:text-xl">
            Stoke is high. Coordinate pickup with your seller.
          </p>
        </motion.div>

        {data.pickupCode ? (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`mb-8 overflow-hidden rounded-xl border text-card-foreground shadow-sm ${pickupCodeBannerSurfaceClassName}`}
          >
            <div className="p-6 text-center md:p-8">
              <div
                className={`mb-2 text-xs font-medium uppercase tracking-wider ${pickupCodeBannerLabelClassName}`}
              >
                Your pickup code
              </div>
              <p className="py-2 text-4xl font-mono font-bold tracking-[0.3em] text-foreground md:text-5xl">
                {data.pickupCode}
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                One code for this whole order — share it when you pick up {pickupTargetPhrase}. The seller
                enters it to confirm the handoff and release their payout.
              </p>
            </div>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
        >
          <div className="grid gap-8 p-6 md:grid-cols-2 md:p-8">
            <div className="space-y-4">
              {lines.length <= 1 ? (
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {head?.imageUrl ? (
                    <Image
                      src={head.imageUrl}
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
              ) : (
                <div>
                  <p className="mb-3 text-sm font-medium text-muted-foreground">Included in this pickup</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                    {lines.map((line) => (
                      <div
                        key={line.listingId ?? line.title}
                        className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                          {line.imageUrl ? (
                            <Image
                              src={line.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 45vw, 25vw"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Package className="h-10 w-10 opacity-40" />
                            </div>
                          )}
                        </div>
                        <p className="text-[13px] font-semibold leading-snug line-clamp-3">{line.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center">
              <div className="mb-6">
                <div className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {category}
                </div>
                {lines.length <= 1 ? (
                  <>
                    <h2 className="mb-2 text-3xl font-semibold tracking-tight">{head?.title ?? "Your item"}</h2>
                    {head?.subtitle ? <div className="mb-4 text-muted-foreground">{head.subtitle}</div> : null}
                  </>
                ) : (
                  <>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">{multiItemHeading}</h2>
                    <ul className="mb-4 space-y-1.5 text-[15px] leading-snug text-muted-foreground">
                      {lines.map((line) => (
                        <li key={line.listingId ?? line.title}>• {line.title}</li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="text-2xl font-medium tabular-nums">{money(data.total)}</div>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <div className="flex items-start gap-3">
                  <Package className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden />
                  <div>
                    <div className="mb-1 text-sm">Order number</div>
                    <div className="font-mono text-sm text-muted-foreground">
                      Order #{data.displayNumber}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden />
                  <div>
                    <div className="mb-1 text-sm">Local pickup</div>
                    <div className="text-sm text-muted-foreground">
                      Coordinate time and place with the seller via Messages.
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Bring your pickup code when you meet the seller.
                    </div>
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
          className="flex flex-col justify-center gap-3 sm:flex-row sm:justify-center"
        >
          {messagesHref ? (
            <Button size="lg" asChild>
              <Link href={messagesHref} className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Message seller
              </Link>
            </Button>
          ) : (
            <Button size="lg" asChild>
              <Link href={`/dashboard/purchases/${data.orderId}`} className="gap-2">
                View pickup details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button size="lg" variant="outline" asChild>
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
            href={`/dashboard/purchases/${data.orderId}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            View purchase details
          </Link>
        </motion.div>
      </div>
    </main>
  )
}
