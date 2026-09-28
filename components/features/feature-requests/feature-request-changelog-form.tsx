"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { publishFeatureRequestChangelogAction } from "@/lib/actions/featureRequests"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface FeatureRequestChangelogFormProps {
  requestId: string
  initialTitle: string
  initialBody: string
  hasEntry: boolean
}

export function FeatureRequestChangelogForm({
  requestId,
  initialTitle,
  initialBody,
  hasEntry,
}: FeatureRequestChangelogFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)

  function onPublish(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await publishFeatureRequestChangelogAction({ requestId, title, body })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(hasEntry ? "Changelog updated." : "Published to the changelog.")
      router.refresh()
    })
  }

  return (
    <form onSubmit={onPublish} className="mt-6 space-y-3 border-t border-neutral-200 pt-4">
      <p className="text-xs font-medium text-neutral-500">Changelog</p>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={140}
        className="bg-white"
        aria-label="Changelog title"
      />
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        maxLength={5000}
        className="bg-white"
        aria-label="Changelog notes"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-full bg-[#3B6CF6] px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {hasEntry ? "Update changelog" : "Publish to changelog"}
      </button>
    </form>
  )
}
