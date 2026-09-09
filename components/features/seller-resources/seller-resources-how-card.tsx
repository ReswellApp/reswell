import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function SellerResourcesHowCard({
  step,
  title,
  children,
  visual,
}: {
  step: number
  title: string
  children: ReactNode
  visual?: ReactNode
}) {
  return (
    <li
      className={cn(
        "rounded-[1.75rem] bg-[#F4F7FB] px-5 py-6 sm:px-8 sm:py-8",
        visual ? "space-y-6" : null,
      )}
    >
      <div className="flex gap-4 sm:gap-6">
        <span className="font-headline text-4xl font-bold leading-none text-listingHeart sm:text-5xl">
          {step}
        </span>
        <div className="min-w-0 pt-1">
          <h3 className="text-xl font-bold tracking-tight text-[#001A4A] sm:text-2xl">{title}</h3>
          <div className="mt-2 text-sm leading-relaxed text-[#5c6b89] sm:text-base">{children}</div>
        </div>
      </div>
      {visual}
    </li>
  )
}
