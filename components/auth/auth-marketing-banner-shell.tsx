import type { ReactNode } from "react"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { cn } from "@/lib/utils"

type AuthMarketingBannerShellProps = {
  children: ReactNode
  className?: string
}

/** Reverb-style auth page: logo header, brand banner, centered card overlap. */
export function AuthMarketingBannerShell({
  children,
  className,
}: AuthMarketingBannerShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border/60 bg-background">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[72rem] items-center px-4 py-4 sm:min-h-[80px] sm:px-6 lg:px-8">
          <SiteWordmarkLink />
        </div>
      </header>

      <div className="relative flex flex-1 flex-col">
        <div className="h-36 w-full bg-listingHeart sm:h-44" aria-hidden />
        <div className="flex flex-1 justify-center px-4 pb-10 sm:px-6 sm:pb-14">
          <div
            className={cn(
              "-mt-20 w-full max-w-lg rounded-2xl border border-border/80 bg-card px-6 py-8 shadow-lg sm:-mt-24 sm:px-8 sm:py-10",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
