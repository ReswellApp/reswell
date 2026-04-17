import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Outer pill: white field + optional black Search button (matches site nav search). */
export const SITE_SEARCH_SHELL_CLASS =
  "flex w-full min-w-0 items-center gap-1 rounded-full border border-border bg-background pl-2 pr-1.5 py-0.5 transition-shadow focus-within:border-cerulean/40 focus-within:ring-2 focus-within:ring-cerulean/15 focus-within:shadow-sm"

export function siteSearchInputClassName(options?: { compact?: boolean }) {
  return cn(
    "w-full border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground",
    options?.compact
      ? "h-10 min-h-[2.5rem] px-0 pl-3 text-base md:text-sm"
      : "h-12 pl-4 text-base md:text-[15px]",
  )
}

/** Same height and pill rounding as `SiteSearchShell` for filter rows (e.g. /boards). */
export const SITE_FILTER_BAR_HEIGHT = "h-12 min-h-[3rem]"

export function siteFilterSelectTriggerClassName(className?: string) {
  return cn(
    SITE_FILTER_BAR_HEIGHT,
    "w-full rounded-full border-border px-4 text-[15px] shadow-sm transition-shadow focus:outline-none focus-visible:border-cerulean/40 focus-visible:ring-2 focus-visible:ring-cerulean/15 focus-visible:ring-offset-2",
    className,
  )
}

/** Bordered text field (location, etc.) aligned with the pill search bar height. */
export function siteFilterBorderedInputClassName(className?: string) {
  return cn(
    SITE_FILTER_BAR_HEIGHT,
    "w-full min-w-0 rounded-full border border-border bg-background pl-10 pr-3 text-[15px] shadow-sm transition-shadow placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-cerulean/40 focus-visible:ring-2 focus-visible:ring-cerulean/15 focus-visible:ring-offset-0",
    className,
  )
}

export function siteFilterIconButtonClassName(className?: string) {
  return cn(SITE_FILTER_BAR_HEIGHT, "w-12 shrink-0 rounded-full border-border px-0", className)
}

export function siteSearchSubmitButtonClassName(compact?: boolean) {
  return cn(
    "h-10 shrink-0 rounded-full px-5 text-[14px]",
    compact && "h-9 px-4 text-sm",
  )
}

export function SiteSearchFormSubmitButton({
  compact,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { compact?: boolean }) {
  return (
    <Button
      type="submit"
      size="sm"
      className={cn(siteSearchSubmitButtonClassName(compact), className)}
      {...props}
    />
  )
}

export type SiteSearchShellProps = {
  children: React.ReactNode
  /** Right-side black pill control (usually `<Button type="submit">Search</Button>`). */
  actionSlot: React.ReactNode
  className?: string
}

/**
 * Visual shell only — use inside an existing `<form>` when the bar is not the form root
 * (e.g. surfboards filters with multiple fields).
 */
export function SiteSearchShell({ children, actionSlot, className }: SiteSearchShellProps) {
  return (
    <div className={cn(SITE_SEARCH_SHELL_CLASS, className)}>
      <div className="relative min-w-0 flex-1">{children}</div>
      {actionSlot}
    </div>
  )
}

export type SiteSearchBarProps = Omit<React.ComponentProps<"form">, "children"> & {
  children: React.ReactNode
  submitLabel?: string
  /** Slightly shorter bar for popovers and tight layouts. */
  compact?: boolean
}

export const SiteSearchBar = React.forwardRef<HTMLFormElement, SiteSearchBarProps>(
  function SiteSearchBar(
    { children, className, submitLabel = "Search", compact, ...formProps },
    ref,
  ) {
    return (
      <form ref={ref} className={cn(SITE_SEARCH_SHELL_CLASS, className)} {...formProps}>
        <div className="relative min-w-0 flex-1">{children}</div>
        <Button
          type="submit"
          size="sm"
          className={siteSearchSubmitButtonClassName(compact)}
        >
          {submitLabel}
        </Button>
      </form>
    )
  },
)

SiteSearchBar.displayName = "SiteSearchBar"
