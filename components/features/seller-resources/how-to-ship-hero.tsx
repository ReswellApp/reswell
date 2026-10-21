import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { wideShimmer } from "@/lib/image-shimmer"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

export function HowToShipHero() {
  return (
    <section className="border-b border-border bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:py-0">
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:py-16 lg:text-left">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-[#001A4A] sm:text-5xl sm:leading-[1.05]">
            Ship it so it arrives in one piece
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#243044] sm:text-lg">
            Offer shipping on a listing, pack the board, and print a label after the sale.
            Pickup still works if you would rather meet locally.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[#001A4A] px-8 font-semibold text-white hover:bg-[#001A4A]/90"
            >
              <Link href={SURFBOARD_SELL_BOARDS_CREATE_HREF}>Start a listing</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-[#001A4A]/20 bg-white px-8 font-semibold text-[#001A4A] hover:bg-[#F9F9F2]"
            >
              <Link href="/shipping-estimator">Shipping estimator</Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl bg-muted lg:mx-0 lg:aspect-auto lg:h-80 lg:max-w-none">
          <Image
            src="/images/seller-resources/how-to-ship/sleeve-full.jpg"
            alt="A surfboard wrapped in a honeycomb cardboard sleeve, ready to box"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 480px"
            quality={80}
            className="object-cover object-center"
            placeholder="blur"
            blurDataURL={wideShimmer}
          />
        </div>
      </div>
    </section>
  )
}
