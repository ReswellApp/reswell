import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Cream CTA surface — Tailwind `footerHeart` / #F9F9F2 (homepage “Every board…” strip). */
export const marketingCtaBannerLinkClassName =
  "no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-footerHeart px-8 py-8 transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** Block layout (e.g. homepage “Ready to get started?” row with buttons). */
export const marketingCtaBannerPanelClassName =
  "rounded-2xl bg-footerHeart px-6 py-8 sm:px-8"

export type MarketingCtaBannerProps = {
  href: string
  title: string
  description: string
  ctaLabel: string
  /** Outer wrapper (default full-width container). */
  outerClassName?: string
  /** When set, wraps the link in `mx-auto` + this class (e.g. `max-w-3xl` to match a narrow column). */
  innerClassName?: string
  sectionClassName?: string
}

export function MarketingCtaBanner({
  href,
  title,
  description,
  ctaLabel,
  outerClassName = "container mx-auto",
  innerClassName,
  sectionClassName,
}: MarketingCtaBannerProps) {
  const link = (
    <Link href={href} className={marketingCtaBannerLinkClassName}>
      <div>
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )

  return (
    <section className={cn("py-8", sectionClassName)}>
      <div className={outerClassName}>
        {innerClassName ? <div className={cn("mx-auto", innerClassName)}>{link}</div> : link}
      </div>
    </section>
  )
}
