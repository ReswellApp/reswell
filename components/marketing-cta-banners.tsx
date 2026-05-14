import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Marketing CTA surface — white tile, hairline ink outline (`foreground` @ low opacity). */
export const marketingCtaBannerLinkClassName =
  "no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl border-[0.5px] border-foreground/20 bg-white px-8 py-8 transition-colors hover:bg-neutral-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/[0.08] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-neutral-100/80"

/** Block layout (e.g. homepage “Ready to get started?” row with buttons). */
export const marketingCtaBannerPanelClassName =
  "rounded-2xl border-[0.5px] border-foreground/20 bg-white px-6 py-8 sm:px-8"

/** Typography on {@link marketingCtaBannerLinkClassName} / {@link marketingCtaBannerPanelClassName}. */
export const marketingCtaBannerTitleClassName = "text-lg font-semibold text-foreground"

export const marketingCtaBannerDescriptionClassName = "mt-1 text-pretty text-muted-foreground"

export const marketingCtaBannerCtaLabelClassName =
  "inline-flex shrink-0 items-center gap-2 font-medium text-foreground"

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
        <p className={marketingCtaBannerTitleClassName}>{title}</p>
        <p className={marketingCtaBannerDescriptionClassName}>{description}</p>
      </div>
      <span className={marketingCtaBannerCtaLabelClassName}>
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
