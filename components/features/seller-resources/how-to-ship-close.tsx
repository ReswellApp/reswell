import type { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SANTA_BARBARA_DROPOFF_HREF } from "@/lib/dropoff-santa-barbara"
import { helpArticlePath } from "@/lib/help-center/paths"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

const linkClass = "font-medium text-[#355185] underline underline-offset-2"

const OPTIONS: readonly { id: string; title: string; body: ReactNode }[] = [
  {
    id: "dropoff",
    title: "Drop it off in Santa Barbara",
    body: (
      <>
        Choose drop-off on the listing. After it sells, we send the location, pack the board, and
        ship it.{" "}
        <Link href={SANTA_BARBARA_DROPOFF_HREF} className={linkClass}>
          How Santa Barbara drop-off works
        </Link>
        .
      </>
    ),
  },
  {
    id: "pickup",
    title: "Meet locally",
    body: (
      <>
        Meet in public, let the buyer inspect the gear, then enter their pickup code on the sale
        page. That releases your payout. Read{" "}
        <Link href="/safety" className={linkClass}>
          safety tips
        </Link>{" "}
        before you meet.
      </>
    ),
  },
]

export function HowToShipOptions() {
  return (
    <section className="bg-white" aria-labelledby="how-to-ship-options-heading">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2
          id="how-to-ship-options-heading"
          className="text-center font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl"
        >
          Rather not pack it yourself?
        </h2>
        <ul className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <li key={option.id} id={option.id} className="rounded-2xl bg-[#f7f5f1] px-5 py-6 sm:px-6">
              <h3 className="text-xl font-semibold tracking-tight text-[#001A4A]">{option.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-[#243044]">{option.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function HowToShipQuestions() {
  return (
    <section className="bg-white px-4 sm:px-6" aria-labelledby="how-to-ship-questions-heading">
      <div className="mx-auto max-w-6xl rounded-2xl bg-[#d5eef4] px-6 py-14 text-center sm:px-10 sm:py-16">
        <h2
          id="how-to-ship-questions-heading"
          className="font-headline text-3xl font-bold tracking-tight text-[#355185] sm:text-4xl"
        >
          Questions?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-[#243044]">
          Buyer-side label details live in the{" "}
          <Link href="/shipping" className={linkClass}>
            shipping guide
          </Link>
          . Order steps are in Help Center, or write us if a sale needs a person.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-[#001A4A] px-7 font-semibold text-white hover:bg-[#001A4A]/90"
          >
            <Link href={helpArticlePath("selling", "how-to-ship-an-order")}>Shipping help</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-[#001A4A]/20 bg-white/80 px-7 font-semibold text-[#001A4A] hover:bg-white"
          >
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function HowToShipClose() {
  return (
    <section className="bg-white px-4 py-16 text-center sm:px-6 sm:py-20">
      <h2 className="font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl">
        Ready to list a board?
      </h2>
      <p className="mt-2 text-base text-[#243044]">
        It is free to post. Fees apply only when you make a sale.
      </p>
      <Button
        asChild
        size="lg"
        className="mt-6 rounded-full bg-[#001A4A] px-8 font-semibold text-white hover:bg-[#001A4A]/90"
      >
        <Link href={SURFBOARD_SELL_BOARDS_CREATE_HREF}>Start a listing</Link>
      </Button>
    </section>
  )
}
