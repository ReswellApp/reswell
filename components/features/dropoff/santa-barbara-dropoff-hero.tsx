import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"
import santaBarbaraMesaLane from "@/public/images/cities/santa-barbara-mesa-lane.jpg"

export function SantaBarbaraDropoffHero() {
  return (
    <section className="relative isolate min-h-[32rem] overflow-hidden sm:min-h-[36rem] lg:min-h-[40rem]">
      <Image
        src={santaBarbaraMesaLane}
        alt=""
        fill
        priority
        fetchPriority="high"
        quality={100}
        unoptimized
        sizes="100vw"
        className="object-cover object-[center_62%] md:object-[38%_55%]"
        placeholder="blur"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#001A4A]/88 via-[#001A4A]/62 to-[#001A4A]/28"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#001A4A]/70 via-transparent to-[#001A4A]/25"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[32rem] max-w-6xl flex-col justify-end px-4 py-14 sm:min-h-[36rem] sm:px-6 sm:py-20 lg:min-h-[40rem] lg:justify-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
          Santa Barbara drop-off
        </p>
        <h1 className="mt-3 max-w-3xl font-headline text-4xl font-bold tracking-tight text-white sm:text-5xl sm:leading-[1.05] lg:text-6xl">
          Drop it off here. We pack and ship it nationwide.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
          If your used surfboard hasn&apos;t sold locally, Santa Barbara drop-off is how you reach
          buyers across the country — without boxing it yourself. Choose this city when you list.
          After it sells, we send you the location.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-white px-8 font-semibold text-[#001A4A] hover:bg-white/90"
          >
            <Link href={SURFBOARD_SELL_BOARDS_CREATE_HREF}>List a board</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-white/40 bg-transparent px-8 font-semibold text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="#how-it-works">How it works</Link>
          </Button>
        </div>
        <p className="mt-5 text-sm text-white/65">
          The street address stays private. We share drop-off details after the sale.
        </p>
      </div>
    </section>
  )
}
