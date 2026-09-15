import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const rowClass =
  "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-listingHeart"

export function SupportHubActionGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card">
      {children}
    </div>
  )
}

export function SupportHubActionLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link href={href} className={rowClass}>
      <span>{children}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </Link>
  )
}

export function SupportHubActionDrawer({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="group" defaultOpen={defaultOpen}>
      <summary
        className={cn(
          rowClass,
          "cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <span>{title}</span>
        <span className="flex items-center gap-2 text-[13px] font-normal text-muted-foreground">
          {hint}
          <ChevronDown
            className="h-4 w-4 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>
      <div className="border-t border-border/50 px-4 py-4">{children}</div>
    </details>
  )
}
