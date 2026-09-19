import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const SECTION_SCROLL_CLASS =
  "scroll-mt-[calc(var(--site-header-height,4rem)+3.25rem)]"

export function ModelPageSection({
  id,
  tone = "plain",
  first = false,
  last = false,
  children,
}: {
  id: string
  tone?: "plain" | "muted"
  first?: boolean
  last?: boolean
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn(
        SECTION_SCROLL_CLASS,
        !first && "border-t border-border/80",
        tone === "muted" ? "bg-neutral-100" : "bg-background",
      )}
    >
      <div
        className={cn(
          "container mx-auto max-w-6xl px-4 sm:px-6",
          first ? "py-8 sm:py-10" : "py-10 sm:py-12",
          last && "pb-16 sm:pb-20",
        )}
      >
        {children}
      </div>
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
    return <h2 className="text-lg font-semibold tracking-tight text-foreground">{children}</h2>
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{children}</h2>
      {action}
    </div>
  )
}
