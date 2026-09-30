"use client"

import {
  AlertTriangle,
  CheckCircle2,
  Monitor,
  Smartphone,
  XCircle,
} from "lucide-react"
import type { EmailStudioPreflightIssue } from "@/lib/email-studio/preflight"
import { cn } from "@/lib/utils"

export function EmailStudioReviewPreview({
  issues,
  html,
}: {
  issues: EmailStudioPreflightIssue[]
  html: string
}) {
  const errors = issues.filter((issue) => issue.severity === "error")
  const warnings = issues.filter((issue) => issue.severity === "warning")
  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-y-auto border-b bg-[#fafafa] p-5 lg:border-b-0 lg:border-r">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#71717a]">Preflight</p>
        {issues.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mb-2 h-5 w-5" />
            Variables, links, required content, and unsubscribe are ready.
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((issue, index) => <IssueRow key={`error-${issue.code}-${index}`} issue={issue} />)}
            {warnings.map((issue, index) => <IssueRow key={`warning-${issue.code}-${index}`} issue={issue} />)}
          </div>
        )}
        <div className="mt-5 rounded-lg border bg-white p-3 text-xs leading-relaxed text-[#71717a]">
          Errors block publishing. Warnings are safe to review and intentionally approve.
        </div>
      </aside>

      <div className="min-h-0 overflow-y-auto bg-[#e6e6e6] p-4 sm:p-6">
        <div className="grid min-h-full gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
          <PreviewFrame icon={Monitor} label="Desktop" html={html} />
          <PreviewFrame icon={Smartphone} label="Mobile" html={html} mobile />
        </div>
      </div>
    </div>
  )
}

function IssueRow({ issue }: { issue: EmailStudioPreflightIssue }) {
  const error = issue.severity === "error"
  const Icon = error ? XCircle : AlertTriangle
  return (
    <div className={cn("flex gap-2 rounded-lg border p-3 text-xs leading-relaxed", error ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{issue.message}</span>
    </div>
  )
}

function PreviewFrame({
  icon: Icon,
  label,
  html,
  mobile = false,
}: {
  icon: typeof Monitor
  label: string
  html: string
  mobile?: boolean
}) {
  return (
    <section className="flex min-h-[580px] min-w-0 flex-col">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#52525b]">
        <Icon className="h-4 w-4" />
        {label}
        <span className="text-[#a1a1aa]">{mobile ? "390 px" : "600 px"}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-black/10 bg-[#f7f6f2] p-3 shadow-sm">
        <iframe
          title={`${label} email preview`}
          sandbox=""
          srcDoc={html}
          className="mx-auto block h-[720px] max-w-full border-0 bg-white"
          style={{ width: mobile ? 390 : 600 }}
        />
      </div>
    </section>
  )
}
