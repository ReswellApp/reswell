"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  getSupportReplyDraftAction,
  rateSupportReplyDraftAction,
  regenerateSupportReplyDraftAction,
} from "@/lib/actions/supportReplyDraft"
import type { SupportReplyDraftView } from "@/lib/types/supportReplyDraft"
import type { SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"
import { supportReplyExampleRatingToast } from "@/components/features/admin/support-reply-examples/support-reply-example-rating"

const PEEK_RETRY_MS = 350
const PEEK_RETRIES = 3

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function useSupportReplyDraft(caseId: string | null, revision: string | null = null) {
  const [draft, setDraft] = useState<SupportReplyDraftView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState<SupportReplyDraftRating | null>(null)
  const [ratingPending, setRatingPending] = useState(false)
  const requestId = useRef(0)
  const seenRevision = useRef<string | null>(null)

  const load = useCallback(async (
    id: string,
    force = false,
    rewrite?: { instruction?: string; currentDraft?: string },
  ) => {
    const ticket = ++requestId.current
    setLoading(true)
    setError(null)

    if (!force) {
      for (let attempt = 0; attempt <= PEEK_RETRIES; attempt += 1) {
        if (attempt > 0) {
          await wait(PEEK_RETRY_MS)
          if (ticket !== requestId.current) return
        }
        const peeked = await getSupportReplyDraftAction({ case_id: id, peek: true })
        if (ticket !== requestId.current) return
        if ("data" in peeked) {
          setDraft(peeked.data)
          setRating(null)
          setLoading(false)
          return
        }
        if ("error" in peeked) {
          setError(peeked.error)
          setDraft(null)
          setLoading(false)
          return
        }
      }
    }

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
    if ("pending" in result) {
      setError(null)
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
      seenRevision.current = null
      return
    }
    setDraft(null)
    setError(null)
    setRating(null)
    seenRevision.current = null
    void load(caseId, false)
    return () => {
      requestId.current += 1
    }
  }, [caseId, load])

  useEffect(() => {
    if (!caseId || !revision) return
    if (seenRevision.current == null) {
      seenRevision.current = revision
      return
    }
    if (seenRevision.current === revision) return
    seenRevision.current = revision
    void load(caseId, false)
  }, [caseId, revision, load])

  const scopedDraft = draft && caseId && draft.caseId === caseId ? draft : null

  const regenerate = useCallback(
    (rewrite?: { instruction?: string; currentDraft?: string }) => {
      if (!caseId) return
      void load(caseId, true, rewrite)
    },
    [caseId, load],
  )

  const rate = useCallback(
    async (next: SupportReplyDraftRating) => {
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
      toast.success(supportReplyExampleRatingToast(next))
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
