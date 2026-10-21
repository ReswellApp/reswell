import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { SurfboardDingIcon } from "@/components/features/sell/sell-photo-example-icons"
import { HowToShipPackingVideos } from "@/components/features/seller-resources/how-to-ship-packing-videos"
import { wideShimmer } from "@/lib/image-shimmer"
import { HOW_TO_SELL_HREF } from "@/lib/seller-resources"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN,
} from "@/lib/seller-resources-box-guide"

const linkClass = "font-medium text-[#355185] underline underline-offset-2"

const STEPS: readonly {
  title: string
  body: ReactNode
  src?: string
  alt?: string
}[] = [
  {
    title: "Repair or show dings",
    body: (
      <>
        Ship a fully repaired board. If any dings are still open, the listing needs clear photos
        that show each one.{" "}
        <Link href={`${HOW_TO_SELL_HREF}#photos`} className={linkClass}>
          See the photo examples
        </Link>
        .
      </>
    ),
  },
  {
    title: "Add a sleeve",
    body: "A honeycomb sleeve follows the outline and keeps the deck from rubbing in transit.",
    src: "/images/seller-resources/how-to-ship/sleeve-nose.jpg",
    alt: "The nose of a surfboard covered by a honeycomb cardboard sleeve",
  },
  {
    title: "Use a snug carton",
    body: "Fold a board box around it and fill gaps so nothing shifts. Honeycomb lining does the padding.",
    src: "/images/seller-resources/how-to-ship/honeycomb-interior.jpg",
    alt: "Open surfboard box lined with honeycomb cardboard",
  },
  {
    title: "Mark it fragile",
    body: "Label the carton before the carrier takes it, then drop it off.",
    src: "/images/seller-resources/how-to-ship/fragile-labels.jpg",
    alt: "A roll of Fragile and Handle with Care labels in front of surfboards",
  },
]

export function HowToShipPackGuide() {
  return (
    <section id="pack" className="bg-white" aria-labelledby="how-to-ship-pack-heading">
      <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#355185]">
            How to pack
          </p>
          <h2
            id="how-to-ship-pack-heading"
            className="mt-2 font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl"
          >
            Pack the board
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#243044]">
            Need a carton first?{" "}
            <Link href="#find-a-box" className={linkClass}>
              Where to find a box
            </Link>
            . For the best rates, pack into {HOW_TO_SELL_BEST_RATE_BOX.lengthIn}×
            {HOW_TO_SELL_BEST_RATE_BOX.widthIn}×{HOW_TO_SELL_BEST_RATE_BOX.heightIn} or stay under{" "}
            {HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN}″.
          </p>
        </header>

        <ol className="mt-10 grid gap-5 lg:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl bg-[#f7f5f1] p-5 sm:p-6">
              <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div>
                  <p className="font-headline text-4xl font-bold leading-none text-[#355185]">
                    {index + 1}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight text-[#001A4A]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-[#243044]">{step.body}</p>
                </div>
                {step.src && step.alt ? (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#efece6]">
                    <Image
                      src={step.src}
                      alt={step.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, 360px"
                      quality={75}
                      className="object-cover"
                      placeholder="blur"
                      blurDataURL={wideShimmer}
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-white">
                    <SurfboardDingIcon className="h-36 w-36 text-[#001A4A]" />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <HowToShipPackingVideos />
        </div>
      </div>
    </section>
  )
}
