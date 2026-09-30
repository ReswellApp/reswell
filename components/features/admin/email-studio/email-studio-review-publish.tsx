"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Loader2,
  Send,
} from "lucide-react"
import {
  withEmailPreviewSamples,
} from "@/lib/email-studio/render-html"
import {
  validateEmailStudioPreflight,
} from "@/lib/email-studio/preflight"
import type { EmailStudioDocument } from "@/lib/types/emailStudio"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { EmailStudioReviewPreview } from "@/components/features/admin/email-studio/email-studio-review-preview"

const TEST_EMAIL_STORAGE_KEY = "reswell-email-studio-test-recipient"

interface PublishResult {
  success: boolean
  message: string
}

export function EmailStudioReviewPublish({
  open,
  subject,
  previewText,
  document,
  html,
  connected,
  onOpenChange,
  onPublish,
}: {
  open: boolean
  subject: string
  previewText: string
  document: EmailStudioDocument
  html: string
  connected: boolean
  onOpenChange: (open: boolean) => void
  onPublish: (recipient: string) => Promise<PublishResult>
}) {
  const [recipient, setRecipient] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)
  const issues = useMemo(
    () => validateEmailStudioPreflight({ subject, previewText, document }),
    [document, previewText, subject],
  )
  const errors = issues.filter((issue) => issue.severity === "error")
  const warnings = issues.filter((issue) => issue.severity === "warning")
  const previewHtml = useMemo(() => withEmailPreviewSamples(html), [html])
  const validRecipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())

  useEffect(() => {
    if (!open) return
    setResult(null)
    try {
      setRecipient(window.localStorage.getItem(TEST_EMAIL_STORAGE_KEY) ?? "")
    } catch {
      setRecipient("")
    }
  }, [open])

  async function publish(): Promise<void> {
    const email = recipient.trim()
    if (!validRecipient || errors.length > 0 || !connected) return
    setPublishing(true)
    setResult(null)
    try {
      window.localStorage.setItem(TEST_EMAIL_STORAGE_KEY, email)
    } catch {
      // Storage is optional; publishing still works.
    }
    const next = await onPublish(email)
    setResult(next)
    setPublishing(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !publishing && onOpenChange(next)}>
      <DialogContent
        className="flex h-[min(92vh,900px)] w-[calc(100vw-2rem)] max-w-[1440px] flex-col gap-0 overflow-hidden p-0"
        showCloseButton={!publishing}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle>Review and publish</DialogTitle>
            <PreflightBadge errors={errors.length} warnings={warnings.length} />
          </div>
          <DialogDescription>
            Validate the email, compare desktop and mobile, send a test, and sync the approved version to Klaviyo.
          </DialogDescription>
        </DialogHeader>

        <EmailStudioReviewPreview issues={issues} html={previewHtml} />

        <footer className="shrink-0 border-t bg-white px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <Input
                type="email"
                aria-label="Test email recipient"
                value={recipient}
                placeholder="Test recipient email"
                disabled={publishing}
                onChange={(event) => {
                  setRecipient(event.target.value)
                  setResult(null)
                }}
              />
              {result ? (
                <p className={`mt-1.5 text-xs ${result.success ? "text-emerald-700" : "text-destructive"}`}>
                  {result.message}
                </p>
              ) : null}
            </div>
            <Button
              className="h-10 shrink-0"
              disabled={publishing || result?.success === true || errors.length > 0 || !validRecipient || !connected}
              onClick={() => void publish()}
            >
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {publishing ? "Testing and publishing…" : result?.success ? "Published" : "Send test & publish"}
            </Button>
          </div>
          {!connected ? <p className="mt-2 text-xs text-destructive">Connect the Klaviyo API key before publishing.</p> : null}
        </footer>
      </DialogContent>
    </Dialog>
  )
}

function PreflightBadge({ errors, warnings }: { errors: number; warnings: number }) {
  if (errors > 0) {
    return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">{errors} error{errors === 1 ? "" : "s"}</span>
  }
  if (warnings > 0) {
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">{warnings} warning{warnings === 1 ? "" : "s"}</span>
  }
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Ready</span>
}
