import Link from "next/link"
import { cn } from "@/lib/utils"

type HelpCenterNeedHelpProps = {
  className?: string
}

export function HelpCenterNeedHelp({ className }: HelpCenterNeedHelpProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-listingHeart/20 bg-listingHeart/5 px-5 py-6 sm:px-8 sm:py-8",
        className,
      )}
    >
      <h2 className="font-headline text-xl font-bold text-neutral-900 sm:text-2xl">
        Still need help?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700 sm:text-base">
        Search didn&apos;t cover it? Open a case with the team — we read every message. For a
        specific purchase or sale, start from the order and tap <strong>Get help</strong>.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/support"
          className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          Contact support
        </Link>
        <Link
          href="/help/buying/get-help-with-a-purchase"
          className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          How Get help works
        </Link>
      </div>
    </section>
  )
}
