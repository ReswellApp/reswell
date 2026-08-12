"use client"

import { useEffect, useRef, useState, type MouseEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PrivacyPolicyContent } from "@/components/features/legal/privacy-policy-content"
import { TermsOfServiceContent } from "@/components/features/legal/terms-of-service-content"
import { formatLegalLastUpdated } from "@/components/features/legal/legal-prose-classes"

export type LegalDocumentId = "terms" | "privacy"

const LEGAL_PATHS: Record<LegalDocumentId, string> = {
  terms: "/terms",
  privacy: "/privacy",
}

type LegalDocumentDialogProps = {
  open: boolean
  document: LegalDocumentId
  onOpenChange: (open: boolean) => void
}

export function LegalDocumentDialog({
  open,
  document,
  onOpenChange,
}: LegalDocumentDialogProps) {
  const [active, setActive] = useState<LegalDocumentId>(document)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setActive(document)
  }, [open, document])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [active])

  const title = active === "terms" ? "Terms of Service" : "Privacy Policy"
  const fullPageHref = LEGAL_PATHS[active]

  function handleContentClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest("a")
    if (!anchor || !(anchor instanceof HTMLAnchorElement)) return

    const url = new URL(anchor.href, window.location.origin)
    if (url.origin !== window.location.origin) return

    if (url.pathname === "/terms") {
      event.preventDefault()
      setActive("terms")
      return
    }
    if (url.pathname === "/privacy") {
      event.preventDefault()
      setActive("privacy")
      return
    }

    event.preventDefault()
    window.open(url.href, "_blank", "noopener,noreferrer")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="z-[120] bg-black/80"
        className="z-[121] flex max-h-[min(88vh,720px)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl border border-border bg-background p-0 shadow-lg"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription>
            Last updated: {formatLegalLastUpdated()}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"
          onClick={handleContentClick}
        >
          {active === "terms" ? (
            <TermsOfServiceContent compact />
          ) : (
            <PrivacyPolicyContent compact />
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3 sm:px-6">
          <a
            href={fullPageHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Open full page
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
