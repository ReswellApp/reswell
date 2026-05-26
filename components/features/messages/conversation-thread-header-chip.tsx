"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export const conversationThreadHeaderChipClassName =
  "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border/60 bg-card/80 py-1.5 pl-1.5 pr-2 transition-colors hover:bg-muted/50 active:bg-muted/65"

export const conversationThreadHeaderChipThumbClassName =
  "relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted"

export const conversationThreadHeaderChipPrimaryClassName =
  "truncate text-[13px] font-semibold leading-[1.15] text-foreground"

export const conversationThreadHeaderChipSecondaryClassName =
  "truncate text-[13px] font-bold tabular-nums leading-[1.15] text-foreground"

interface ConversationThreadHeaderChipProps {
  href?: string
  ariaLabel: string
  thumb: React.ReactNode
  primary: React.ReactNode
  secondary?: React.ReactNode
  className?: string
}

export function ConversationThreadHeaderChip({
  href,
  ariaLabel,
  thumb,
  primary,
  secondary,
  className,
}: ConversationThreadHeaderChipProps) {
  const content = (
    <>
      <div className={conversationThreadHeaderChipThumbClassName}>{thumb}</div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            conversationThreadHeaderChipPrimaryClassName,
            !secondary && "text-[14px] leading-[1.2]",
          )}
        >
          {primary}
        </p>
        {secondary ? (
          <p className={conversationThreadHeaderChipSecondaryClassName}>{secondary}</p>
        ) : null}
      </div>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={cn(conversationThreadHeaderChipClassName, className)}
      >
        {content}
      </Link>
    )
  }

  return (
    <div aria-label={ariaLabel} className={cn(conversationThreadHeaderChipClassName, className)}>
      {content}
    </div>
  )
}
