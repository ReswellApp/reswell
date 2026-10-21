import type { ReactNode } from "react"
import Link from "next/link"
import { HOW_TO_SELL_HREF } from "@/lib/seller-resources"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN,
} from "@/lib/seller-resources-box-guide"

const linkClass = "font-medium text-[#355185] underline underline-offset-2"

const SOURCES: readonly { title: string; body: ReactNode }[] = [
  {
    title: "Ask a surf shop",
    body: (
      <>
        Local shops often have spare board boxes, or will sell you one from the back.{" "}
        <Link href="/surf-shops" className={linkClass}>
          Find a shop
        </Link>
        .
      </>
    ),
  },
  {
    title: "Order online",
    body: (
      <>
        <a
          href="https://anewearthproject.com"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          A New Earth Project
        </a>{" "}
        sells recyclable surfboard cartons made for this kind of shipment.
      </>
    ),
  },
  {
    title: "Buy from Reswell",
    body: (
      <>
        Order a board box directly from the{" "}
        <Link href="/reswell/shop" className={linkClass}>
          Reswell shop
        </Link>
        .
      </>
    ),
  },
]

export function HowToShipBoxes() {
  const box = HOW_TO_SELL_BEST_RATE_BOX

  return (
    <section id="find-a-box" className="bg-white" aria-labelledby="how-to-ship-boxes-heading">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#355185]">
            Boxes
          </p>
          <h2
            id="how-to-ship-boxes-heading"
            className="mt-2 font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl"
          >
            Where to find a box
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#243044]">
            A surfboard needs its own carton. For the best rates, pack into {box.lengthIn}×
            {box.widthIn}×{box.heightIn} or stay under {HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN}″. See
            the{" "}
            <Link href={`${HOW_TO_SELL_HREF}#boxes`} className={linkClass}>
              box size guide
            </Link>
            .
          </p>
        </header>
        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {SOURCES.map((source) => (
            <li key={source.title} className="rounded-2xl bg-[#f7f5f1] px-5 py-6 sm:px-6">
              <h3 className="text-xl font-semibold tracking-tight text-[#001A4A]">{source.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-[#243044]">{source.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
