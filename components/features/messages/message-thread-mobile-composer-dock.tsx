"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  messageThreadMobileComposerDockClass,
  messageThreadMobileComposerSpacerClass,
} from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

interface MessageThreadMobileComposerDockProps {
  /** When true, composer is portaled + fixed on mobile; otherwise rendered in-flow. */
  portaled: boolean
  className?: string
  children: ReactNode
}

/**
 * Mobile message composer dock. Portals to document.body so `position: fixed` is not
 * trapped by `.page-enter` transforms on NavigationPageGate ancestors.
 */
export function MessageThreadMobileComposerDock({
  portaled,
  className,
  children,
}: MessageThreadMobileComposerDockProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!portaled) {
    return (
      <div className={cn("relative z-10 mt-1 shrink-0 sm:mt-2", className)}>
        {children}
      </div>
    )
  }

  return (
    <>
      <div className={messageThreadMobileComposerSpacerClass} aria-hidden />
      {mounted
        ? createPortal(
            <div className={cn(messageThreadMobileComposerDockClass, className)}>
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
