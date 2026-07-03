"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { Button } from "@/components/ui/button"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { cn } from "@/lib/utils"

type AuthLandingMode = "login" | "sign-up"

type AuthLandingShellProps = {
  mode: AuthLandingMode
  redirectTo: string
  children: ReactNode
  contentClassName?: string
}

const authNavButtonClassName =
  "h-11 rounded-full px-5 text-[14px] font-medium sm:h-12 sm:px-6"

/** Centered auth canvas — logo header and form share this max width. */
export const authLandingCanvasClassName = "mx-auto w-full max-w-[72rem] px-4 sm:px-6 lg:px-8"

export function AuthLandingShell({
  mode,
  redirectTo,
  children,
  contentClassName,
}: AuthLandingShellProps) {
  const loginHref = authLandingHref("/auth/login", redirectTo)
  const signUpHref = authLandingHref("/auth/sign-up", redirectTo)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border/60">
        <div
          className={cn(
            authLandingCanvasClassName,
            "flex min-h-[72px] items-center justify-between gap-4 py-4 sm:min-h-[80px]",
          )}
        >
          <SiteWordmarkLink />
          <nav aria-label="Account" className="flex items-center gap-2">
            <Button
              asChild
              variant={mode === "sign-up" ? "default" : "outline"}
              className={cn(
                authNavButtonClassName,
                mode === "sign-up"
                  ? "border-0 bg-listingHeart text-white hover:bg-[#2a4170]"
                  : "border-foreground/20 text-foreground hover:bg-muted",
              )}
            >
              <Link href={signUpHref}>Sign up</Link>
            </Button>
            <Button
              asChild
              variant={mode === "login" ? "default" : "outline"}
              className={cn(
                authNavButtonClassName,
                mode === "login"
                  ? "border-0 bg-listingHeart text-white hover:bg-[#2a4170]"
                  : "border-foreground/20 text-foreground hover:bg-muted",
              )}
            >
              <Link href={loginHref}>Log in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center py-10 sm:py-12 lg:py-16">
        <div className={cn(authLandingCanvasClassName, "flex justify-center")}>
          <div className={cn("w-full max-w-lg", contentClassName)}>{children}</div>
        </div>
      </main>
    </div>
  )
}
