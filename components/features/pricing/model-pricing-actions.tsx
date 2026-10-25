import Link from "next/link"
import type { ModelPricingViewModel } from "@/lib/pricing/model-pricing"
import { cn } from "@/lib/utils"

const pillClassName =
  "inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3c5fe0]/40 focus-visible:ring-offset-2"

export function ModelPricingActions({ page }: { page: ModelPricingViewModel }) {
  return (
    <div className="flex flex-col gap-3">
      {page.buy ? (
        <Link href={page.buy.href} className={cn(pillClassName, "bg-[#3c5fe0] text-white hover:bg-[#314fc4]")}>
          {page.buy.label}
        </Link>
      ) : null}
      <Link
        href={page.listingsHref}
        className={cn(
          pillClassName,
          "bg-[#e7edff] text-[#1c2740] hover:bg-[#dbe3ff] dark:bg-[#3c5fe0]/15 dark:text-foreground dark:hover:bg-[#3c5fe0]/25",
        )}
      >
        View listings
      </Link>
      <Link
        href={page.sellHref}
        className={cn(
          pillClassName,
          "border border-[#3c5fe0] bg-white text-[#3c5fe0] hover:bg-[#f4f7ff] dark:bg-transparent dark:hover:bg-[#3c5fe0]/10",
        )}
      >
        Sell yours
      </Link>
      <Link
        href={page.allModelsHref}
        className={cn(
          pillClassName,
          "bg-[#f3efe6] text-[#1c2740] hover:bg-[#ebe4d6] dark:bg-white/10 dark:text-foreground dark:hover:bg-white/15",
        )}
      >
        View all models
      </Link>
    </div>
  )
}
