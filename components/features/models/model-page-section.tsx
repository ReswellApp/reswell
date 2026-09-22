import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const SECTION_SCROLL_CLASS =
  "scroll-mt-[calc(var(--site-header-height,4rem)+3.25rem)]"

export function ModelPageSection({
  id,
  first = false,
  last = false,
  children,
}: {
  id: string
  first?: boolean
  last?: boolean
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn(
        SECTION_SCROLL_CLASS,
        first ? "pt-8 sm:pt-10" : "mt-10 border-t border-border/80 pt-10 sm:mt-12 sm:pt-12",
        last && "pb-0",
      )}
    >
      {children}
    </section>
  )
}

export function ModelPageSectionHeading({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  if (!action) {
    return <h2 className="text-xl font-bold tracking-tight text-foreground">{children}</h2>
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-xl font-bold tracking-tight text-foreground">{children}</h2>
      {action}
    </div>
  )
}
