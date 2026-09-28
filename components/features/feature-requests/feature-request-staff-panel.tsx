"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FeatureRequestChangelogForm } from "@/components/features/feature-requests/feature-request-changelog-form"
import { deleteFeatureRequestAction, updateFeatureRequestStaffAction } from "@/lib/actions/featureRequests"
import { Input } from "@/components/ui/input"
import {
  FEATURE_REQUEST_STATUSES,
  FEATURE_REQUEST_TAGS,
  type FeatureRequestDetail,
  type FeatureRequestStatus,
  type FeatureRequestTag,
} from "@/lib/types/feature-requests"
import {
  FEATURE_REQUEST_STATUS_LABEL,
  FEATURE_REQUEST_TAG_LABEL,
  FEATURE_REQUESTS_PATH,
} from "@/lib/utils/feature-requests"
import { cn } from "@/lib/utils"

interface FeatureRequestStaffPanelProps {
  request: FeatureRequestDetail
}

export function FeatureRequestStaffPanel({ request }: FeatureRequestStaffPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<FeatureRequestStatus>(request.status)
  const [tags, setTags] = useState<FeatureRequestTag[]>(request.tags)
  const [estimate, setEstimate] = useState(request.estimatedLabel ?? "")

  function toggleTag(tag: FeatureRequestTag) {
    setTags((current) => {
      if (current.includes(tag)) return current.filter((item) => item !== tag)
      if (current.length >= 4) return current
      return [...current, tag]
    })
  }

  function onSave(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateFeatureRequestStaffAction({
        requestId: request.id,
        status,
        tags,
        estimatedLabel: estimate,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Idea updated.")
      router.refresh()
    })
  }

  function onDelete() {
    if (!window.confirm("Remove this idea from the board?")) return
    startTransition(async () => {
      const result = await deleteFeatureRequestAction({ requestId: request.id })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      router.push(FEATURE_REQUESTS_PATH)
      router.refresh()
    })
  }

  return (
    <section className="mt-10 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-neutral-950">Team</h2>
      <form onSubmit={onSave} className="mt-3 space-y-3">
        <label className="block text-xs font-medium text-neutral-500">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as FeatureRequestStatus)}
            className="mt-1 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
          >
            {FEATURE_REQUEST_STATUSES.map((value) => (
              <option key={value} value={value}>
                {FEATURE_REQUEST_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-500">
          Estimate
          <Input
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            placeholder="September 2026"
            maxLength={40}
            className="mt-1 bg-white"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FEATURE_REQUEST_TAGS.map((tag) => {
            const selected = tags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium",
                  selected ? "bg-[#E8F0FE] text-[#2F5FE0]" : "bg-white text-neutral-600 ring-1 ring-neutral-200",
                )}
              >
                {FEATURE_REQUEST_TAG_LABEL[tag]}
              </button>
            )
          })}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
      </form>
      <FeatureRequestChangelogForm
        requestId={request.id}
        initialTitle={request.changelog?.title ?? request.title}
        initialBody={request.changelog?.body ?? request.body}
        hasEntry={request.changelog != null}
      />
      <button type="button" onClick={onDelete} disabled={pending} className="mt-4 text-xs text-neutral-500 hover:text-red-700">
        Remove from board
      </button>
    </section>
  )
}
