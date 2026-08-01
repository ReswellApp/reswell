import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  title?: string
  description?: string
  /** Filter control (and anything else) aligned to the title row. */
  action?: ReactNode
  className?: string
}

/**
 * Shared category browse header: title + description on the left, action (Filter) on the right.
 */
export function CategoryBrowsePageHeader({
  title,
  description,
  action,
  className,
}: Props) {
  const hasTitle = Boolean(title?.trim())

  return (
    <header className={cn("w-full min-w-0 border-b border-neutral-200/90 pb-5", className)}>
      {hasTitle ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-2xl">
            <h1 className="font-headline text-3xl font-semibold tracking-tight text-[#001A4A] sm:text-[2.125rem] sm:leading-tight">
              {title!.trim()}
            </h1>
            {description?.trim() ? (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5c6b89] sm:text-[15px]">
                {description.trim()}
              </p>
            ) : null}
          </div>
          {action ? <div className="sm:pb-0.5">{action}</div> : null}
        </div>
      ) : (
        (action ?? null)
      )}
    </header>
  )
}
