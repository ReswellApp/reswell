"use client"

import Link from "next/link"

import { SurfboardShippingEstimator } from "@/components/features/sell/surfboard-shipping-estimator"

export function ShippingEstimatorPage() {
  return (
    <main className="flex-1 py-10 sm:py-14">
      <div className="container mx-auto max-w-lg px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Shipping label cost estimator
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Compare domestic carrier quotes for a packed surfboard. Sign in to see live rates for your lane.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SurfboardShippingEstimator idPrefix="page-ship-est" />
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Selling on Reswell?{" "}
          <Link href="/sell?new=1" className="font-medium text-primary underline underline-offset-4">
            List your board
          </Link>{" "}
          or read the{" "}
          <Link href="/shipping" className="font-medium text-primary underline underline-offset-4">
            shipping guide
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
