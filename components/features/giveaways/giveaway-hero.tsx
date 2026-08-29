import type { ReactNode } from "react"
import Image from "next/image"
import { formatGiveawayEndDate } from "@/lib/giveaways/catalog"
import { wideShimmer } from "@/lib/image-shimmer"
import type { Giveaway } from "@/lib/types/giveaways"
import heroBackdrop from "@/public/images/home/hero-backdrop-tahiti.jpg"

type GiveawayHeroProps = {
  giveaway: Giveaway
  children?: ReactNode
}

export function GiveawayHero({ giveaway, children }: GiveawayHeroProps) {
  const ends = formatGiveawayEndDate(giveaway.endsAt)

  return (
    <section className="relative overflow-hidden">
      <div className="relative isolate min-h-[22rem] sm:min-h-[26rem]">
        <Image
          src={heroBackdrop}
          alt=""
          fill
          priority
          quality={95}
          sizes="100vw"
          className="object-cover object-[center_38%] max-lg:object-[58%_68%]"
          placeholder="blur"
          blurDataURL={wideShimmer}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/30"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex min-h-[22rem] max-w-2xl flex-col justify-end px-4 pb-12 pt-8 sm:min-h-[26rem] sm:px-6 sm:pb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
            {giveaway.eyebrow}
            {ends ? (
              <>
                <span aria-hidden> · </span>
                Ends {ends}
              </>
            ) : null}
          </p>
          <h1 className="mt-3 font-headline text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-balance text-white sm:text-5xl">
            {giveaway.headline}
          </h1>
          <p className="mt-3 max-w-md text-pretty text-base text-white/85 sm:text-lg">
            Publish a surfboard on Reswell. That&apos;s your raffle ticket for a
            custom.
          </p>
          {children}
        </div>
      </div>
    </section>
  )
}
