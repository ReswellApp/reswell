import Link from "next/link"
import { Camera, MessageCircle, ShieldCheck, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"

const BENEFITS = [
  {
    icon: Camera,
    title: "List in minutes",
    body: "Photos, details, and price. Pickup, shipping, or both.",
  },
  {
    icon: MessageCircle,
    title: "Reach surfers who care",
    body: "Messages and offers in one place — with buyers who know the gear.",
  },
  {
    icon: Wallet,
    title: "Get paid your way",
    body: "Earnings in your wallet. Cash out to your bank when you’re ready.",
  },
  {
    icon: ShieldCheck,
    title: "Built for trust",
    body: "Checkout on Reswell. Purchase Protection on eligible sales.",
  },
] as const

/** Compact, high-contrast benefits strip for the sell hub. */
export function SellWhySellSection() {
  return (
    <section className="border-t border-border/60 bg-background px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl">
          Why sell on Reswell?
        </h2>
        <p className="mt-2 text-sm font-medium text-[#5c6b89] sm:text-base">
          Free to list. Built for surfers who actually use the gear.
        </p>

        <ul className="mt-8 grid gap-7 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-8">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col items-center text-center">
              <Icon
                className="h-10 w-10 text-[#5574AD]"
                strokeWidth={2.25}
                aria-hidden
              />
              <h3 className="mt-3 text-lg font-bold tracking-tight text-[#001A4A]">
                {title}
              </h3>
              <p className="mt-1.5 max-w-[18rem] text-sm leading-snug text-[#5c6b89]">
                {body}
              </p>
            </li>
          ))}
        </ul>

        <Button
          asChild
          size="lg"
          className="mt-8 rounded-full bg-[#001A4A] px-8 font-semibold text-white hover:bg-[#001A4A]/90"
        >
          <Link href="#sell-catalog-search">Start your listing</Link>
        </Button>
      </div>
    </section>
  )
}
