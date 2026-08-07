"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const LIST_YOUR_SURFBOARD_SELL_HREF = "/sell?new=1&from=nav"

type ListYourSurfboardSellCtaProps = {
  /** @deprecated Unused — sell flow is public; auth is required at publish. */
  userId?: string | null
  children: React.ReactNode
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
  showArrow?: boolean
  tabIndex?: number
}

export function ListYourSurfboardSellCta({
  children,
  size = "lg",
  variant = "default",
  className,
  showArrow = true,
  tabIndex,
}: ListYourSurfboardSellCtaProps) {
  const arrowClassName = cn("h-4 w-4", size === "sm" ? "ml-1" : "ml-2")

  return (
    <Button size={size} variant={variant} className={className} asChild>
      <Link href={LIST_YOUR_SURFBOARD_SELL_HREF} tabIndex={tabIndex}>
        {children}
        {showArrow ? <ArrowRight className={arrowClassName} aria-hidden /> : null}
      </Link>
    </Button>
  )
}

type ListYourSurfboardSellSectionHeaderProps = {
  title: string
  userId?: string | null
  ctaLabel?: string
}

export function ListYourSurfboardSellSectionHeader({
  title,
  userId,
  ctaLabel = "List a board",
}: ListYourSurfboardSellSectionHeaderProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 sm:mb-8">
      <h2 className="min-w-0 text-xl font-bold leading-tight text-foreground sm:text-2xl">{title}</h2>
      <ListYourSurfboardSellCta userId={userId} size="sm" variant="outline" className="shrink-0">
        {ctaLabel}
      </ListYourSurfboardSellCta>
    </div>
  )
}
