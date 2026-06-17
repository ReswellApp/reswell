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
  return <div className={cn("relative z-10 shrink-0", className)}>{children}</div>
}
