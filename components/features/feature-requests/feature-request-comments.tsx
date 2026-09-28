"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FeatureRequestAvatar } from "@/components/features/feature-requests/feature-request-avatar"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
import { Textarea } from "@/components/ui/textarea"
import {
  addFeatureRequestCommentAction,
  deleteFeatureRequestCommentAction,
} from "@/lib/actions/featureRequests"
import type { FeatureRequestCommentItem } from "@/lib/types/feature-requests"
import { featureRequestAuthorLabel } from "@/lib/utils/feature-requests"

interface FeatureRequestCommentsProps {
  requestId: string
  comments: FeatureRequestCommentItem[]
  truncated: boolean
  signedIn: boolean
  returnPath: string
}

export function FeatureRequestComments({
  requestId,
  comments,
  truncated,
  signedIn,
  returnPath,
}: FeatureRequestCommentsProps) {
  const router = useRouter()
  const requireSignIn = useSignInGate()
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!signedIn) {
      requireSignIn(returnPath)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await addFeatureRequestCommentAction({ requestId, body })
      if ("error" in result) {
        setError(result.error ?? "Could not post that comment. Please try again.")
        return
      }
      setBody("")
      router.refresh()
    })
  }

  function onDelete(commentId: string) {
    if (!window.confirm("Delete this comment?")) return
    startTransition(async () => {
      const result = await deleteFeatureRequestCommentAction({ commentId })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="mt-10 border-t border-neutral-200 pt-8">
      <h2 className="text-lg font-semibold text-neutral-950">Comments</h2>
      {truncated ? (
        <p className="mt-2 text-xs text-neutral-500">Showing the first 100 comments.</p>
      ) : null}
      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No comments yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3 py-4">
              <FeatureRequestAvatar
                displayName={comment.author.displayName}
                avatarUrl={comment.author.avatarUrl}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium text-neutral-900">
                    {featureRequestAuthorLabel(comment.author.displayName)}
                  </span>
                  <RelativeTime
                    iso={comment.createdAt}
                    formatLabel={formatDistanceToNowLabel}
                    className="text-xs text-neutral-500"
                  />
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{comment.body}</p>
                {comment.canDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(comment.id)}
                    className="mt-2 text-xs text-neutral-500 hover:text-neutral-800"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        {signedIn ? (
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a comment"
            rows={3}
            maxLength={2000}
            aria-label="Comment"
          />
        ) : (
          <p className="text-sm text-neutral-600">Sign in to join the discussion.</p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type={signedIn ? "submit" : "button"}
          onClick={signedIn ? undefined : () => requireSignIn(returnPath)}
          disabled={pending}
          className="h-10 rounded-full bg-[#3B6CF6] px-4 text-sm font-medium text-white hover:bg-[#2F5FE0] disabled:opacity-50"
        >
          {signedIn ? (pending ? "Posting…" : "Comment") : "Sign in to comment"}
        </button>
      </form>
    </section>
  )
}
