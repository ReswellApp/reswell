"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  getSupportReplyDraftAction,
  rateSupportReplyDraftAction,
  regenerateSupportReplyDraftAction,
} from "@/lib/actions/supportReplyDraft"
import type { SupportReplyDraftView } from "@/lib/types/supportReplyDraft"

export function useSupportReplyDraft(caseId: string | null) {
  const [draft, setDraft] = useState<SupportReplyDraftView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState<"accepted" | "rejected" | null>(null)
  const [ratingPending, setRatingPending] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(async (
    id: string,
    force = false,
    rewrite?: { instruction?: string; currentDraft?: string },
  ) => {
    const ticket = ++requestId.current
    setLoading(true)
    setError(null)
    const result = force
      ? await regenerateSupportReplyDraftAction({
          case_id: id,
          force: true,
          rewrite_instruction: rewrite?.instruction,
          current_draft: rewrite?.currentDraft,
        })
      : await getSupportReplyDraftAction({ case_id: id })
    if (ticket !== requestId.current) return
    if ("error" in result) {
      setError(result.error)
      setDraft(null)
      setLoading(false)
      return
    }
    setDraft(result.data)
    setRating(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!caseId) {
      setDraft(null)
      setError(null)
      setRating(null)
      setLoading(false)
      return
    }
    setDraft(null)
    setError(null)
    setRating(null)
    void load(caseId, false)
    return () => {
      requestId.current += 1
    }
  }, [caseId, load])

  const scopedDraft = draft && caseId && draft.caseId === caseId ? draft : null

  const regenerate = useCallback(
    (rewrite?: { instruction?: string; currentDraft?: string }) => {
      if (!caseId) return
      void load(caseId, true, rewrite)
    },
    [caseId, load],
  )

  const rate = useCallback(
    async (next: "accepted" | "rejected") => {
      if (!caseId || !scopedDraft || ratingPending) return
      setRatingPending(true)
      const result = await rateSupportReplyDraftAction({
        case_id: caseId,
        draft_id: scopedDraft.id,
        rating: next,
        sent_body: scopedDraft.body,
      })
      setRatingPending(false)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setRating(next)
      toast.success(next === "accepted" ? "Marked as a good draft" : "Marked as not useful")
    },
    [caseId, scopedDraft, ratingPending],
  )

  return {
    draft: scopedDraft,
    loading,
    error,
    rating,
    ratingPending,
    regenerate,
    rate,
  }
}
