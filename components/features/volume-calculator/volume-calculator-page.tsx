import Link from "next/link"

import { VolumeCalculatorForm } from "@/components/features/volume-calculator/volume-calculator-form"

export function VolumeCalculatorPage() {
  return (
    <main className="flex-1 py-10 sm:py-14">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Volume Calculator
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Enter length, width, thickness, and outline to estimate surfboard volume in liters —
            the same figure brands print on model size charts.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <VolumeCalculatorForm />
        </div>

        <div className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Volume is displacement in liters. Two boards with the same length × width × thickness
            can differ by several liters depending on how full the outline and rails are — that is
            why outline matters.
          </p>
          <p className="text-center">
            Selling on Reswell?{" "}
            <Link href="/sell?new=1" className="font-medium text-primary underline underline-offset-4">
              List your board
            </Link>{" "}
            with volume so buyers can filter by liters, or use the{" "}
            <Link
              href="/shipping-estimator"
              className="font-medium text-primary underline underline-offset-4"
            >
              shipping estimator
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  )
}
