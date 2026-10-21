import type { ReactNode } from "react"
import Link from "next/link"
import { SHIPPING_DEADLINE_DAYS } from "@/lib/shipping-deadline"

const linkClass = "font-medium text-[#355185] underline underline-offset-2"
const cardClass = "flex flex-col rounded-2xl border border-border bg-white px-5 py-6 sm:px-6"

const STEPS: readonly { title: string; body: ReactNode }[] = [
  {
    title: "Print the label",
    body: (
      <>
        Open the sale from{" "}
        <Link href="/dashboard/sales" className={linkClass}>
          Sales
        </Link>
        . Print the Reswell label when one is ready, or add your own tracking.
      </>
    ),
  },
  {
    title: "Pack to that carton",
    body: "The label is bought from the box size on your listing. Pack to that carton so the carrier measurement matches.",
  },
  {
    title: "Hand it to the carrier",
    body: `Ship within ${SHIPPING_DEADLINE_DAYS} days of purchase confirmation when you can, then mark the drop-off so the buyer sees progress.`,
  },
  {
    title: "Get paid",
    body: "Earnings are available 4 days after delivery is marked for new sellers. Become a trusted seller and your payout is ready 2 days after delivery.",
  },
]

export function HowToShipAfterSale() {
  return (
    <section id="after-sale" className="border-t border-border bg-white" aria-labelledby="how-to-ship-after-heading">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#355185]">
            When it sells
          </p>
          <h2
            id="how-to-ship-after-heading"
            className="mt-2 font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl"
          >
            From sale to drop-off
          </h2>
        </header>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className={cardClass}>
              <p className="font-headline text-4xl font-bold leading-none text-[#355185]">{index + 1}</p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-[#001A4A]">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-[#243044]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
