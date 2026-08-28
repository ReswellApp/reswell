import Link from "next/link"
import { Camera, Clock, Package, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"

const STEPS = [
  {
    icon: Camera,
    title: "Send photos and your price",
    body: "Title, asking price, and a few clear photos. Takes a couple of minutes.",
  },
  {
    icon: Clock,
    title: "Quote in under 30 minutes",
    body: "We accept your asking price or send our best offer. If we miss the window, you automatically get 20% off your ask.",
  },
  {
    icon: Package,
    title: "Print the label and ship",
    body: "We buy the prepaid label. You box the board and drop it with the carrier.",
  },
  {
    icon: Wallet,
    title: "Paid to your Reswell wallet",
    body: "Once we receive the board, the offer hits your wallet. Cash out to your bank when you’re ready.",
  },
] as const

export function WeBuyLanding({ signedIn }: { signedIn: boolean }) {
  const ctaHref = signedIn ? "/we-buy/submit" : "/auth/login?redirect=/we-buy/submit"

  return (
    <main className="flex-1 bg-background">
      <section className="border-b border-border/60 bg-[#F4F7FB]">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#5574AD]">
            Reswell buy program
          </p>
          <h1 className="mt-3 font-headline text-4xl font-bold tracking-tight text-[#001A4A] sm:text-5xl">
            We’ll buy your surfboard
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[#5c6b89] sm:text-lg">
            Skip the listing wait. Send photos and your asking price — we’ll get back to you in
            under 30 minutes with an accept or our best offer. Prepaid label. Paid to your wallet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[#001A4A] px-8 font-semibold text-white hover:bg-[#001A4A]/90"
            >
              <Link href={ctaHref}>Get a quote</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/sell">List on the marketplace instead</Link>
            </Button>
          </div>
          {!signedIn ? (
            <p className="mt-3 text-sm text-[#5c6b89]">Sign in to submit. Wallet payouts need an account.</p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="font-headline text-2xl font-bold tracking-tight text-[#001A4A] sm:text-3xl">
          How it works
        </h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon className="h-9 w-9 text-[#5574AD]" strokeWidth={2.25} aria-hidden />
              <h3 className="mt-3 text-lg font-bold text-[#001A4A]">{title}</h3>
              <p className="mt-1.5 text-sm leading-snug text-[#5c6b89]">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
