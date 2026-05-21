import Link from "next/link"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { cn } from "@/lib/utils"

export function HelpCenterHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "border-b border-neutral-200 bg-white",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SiteWordmarkLink href="/help" variant="header" className="px-0" />
          <Link
            href="/help"
            className="truncate text-lg font-bold text-neutral-900 sm:text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 rounded-sm"
          >
            Help Center
          </Link>
        </div>
      </div>
    </header>
  )
}
