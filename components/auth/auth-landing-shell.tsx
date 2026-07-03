"use client"

import type { ReactNode } from "react"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { cn } from "@/lib/utils"

type AuthLandingShellProps = {
  children: ReactNode
  contentClassName?: string
}

/** Centered auth canvas — logo header and form share this max width. */
export const authLandingCanvasClassName = "mx-auto w-full max-w-[72rem] px-4 sm:px-6 lg:px-8"

export function AuthLandingShell({
  children,
  contentClassName,
}: AuthLandingShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border/60">
        <div
          className={cn(
            authLandingCanvasClassName,
            "flex min-h-[72px] items-center py-4 sm:min-h-[80px]",
          )}
        >
          <SiteWordmarkLink />
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
