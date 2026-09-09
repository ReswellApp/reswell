import type { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SellerResourcesHeroCta = {
  href: string
  label: string
}

export function SellerResourcesHero({
  title,
  description,
  primaryCta,
  secondaryCta,
  aside,
  compact = false,
}: {
  title: string
  description: string
  primaryCta?: SellerResourcesHeroCta
  secondaryCta?: SellerResourcesHeroCta
  aside?: ReactNode
  compact?: boolean
}) {
  return (
    <section className="bg-[#F4F7FB]">
      <div
        className={cn(
          "mx-auto max-w-6xl px-4 sm:px-6",
          compact ? "py-10 sm:py-12" : "py-14 sm:py-20",
          aside && "grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14",
        )}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
            Seller Resources
          </p>
          <h1 className="mt-3 font-headline text-4xl font-bold tracking-tight text-[#001A4A] sm:text-5xl sm:leading-[1.05]">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#5c6b89]">{description}</p>
          {primaryCta || secondaryCta ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {primaryCta ? (
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-[#001A4A] px-8 font-semibold text-white hover:bg-[#001A4A]/90"
                >
                  <Link href={primaryCta.href}>{primaryCta.label}</Link>
                </Button>
              ) : null}
              {secondaryCta ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full px-8 font-semibold"
                >
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {aside}
      </div>
    </section>
  )
}
