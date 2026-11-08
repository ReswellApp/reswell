"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MessageThreadMobileComposerDockProps {
  className?: string
  children: ReactNode
}

/** In-flow message composer shell below the thread module (not fixed to the viewport). */
export function MessageThreadMobileComposerDock({
  className,
  children,
}: MessageThreadMobileComposerDockProps) {
  return (
    <div
      className={cn(
        "relative z-10 shrink-0 bg-background/90 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/75",
        className,
      )}
    >
      {children}
    </div>
  )
}
