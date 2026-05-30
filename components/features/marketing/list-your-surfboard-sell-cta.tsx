"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const LIST_YOUR_SURFBOARD_SELL_HREF = "/sell?new=1"

type ListYourSurfboardSellCtaProps = {
  userId: string | null
  children: React.ReactNode
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
  showArrow?: boolean
}

export function ListYourSurfboardSellCta({
  userId,
  children,
  size = "lg",
  variant = "default",
  className,
  showArrow = true,
}: ListYourSurfboardSellCtaProps) {
  const openSignIn = useSignInGate()

  const arrowClassName = cn("h-4 w-4", size === "sm" ? "ml-1" : "ml-2")

  if (userId) {
    return (
      <Button size={size} variant={variant} className={className} asChild>
        <Link href={LIST_YOUR_SURFBOARD_SELL_HREF}>
          {children}
          {showArrow ? <ArrowRight className={arrowClassName} aria-hidden /> : null}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      type="button"
      onClick={() => openSignIn(LIST_YOUR_SURFBOARD_SELL_HREF)}
    >
      {children}
      {showArrow ? <ArrowRight className={arrowClassName} aria-hidden /> : null}
    </Button>
  )
}

type ListYourSurfboardSellSectionHeaderProps = {
  title: string
  userId: string | null
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
