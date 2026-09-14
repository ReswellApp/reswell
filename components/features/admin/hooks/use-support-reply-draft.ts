"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  const requestId = useRef(0)

  const load = useCallback(async (id: string, force = false) => {
    const ticket = ++requestId.current
    setLoading(true)
    setError(null)
    const result = force
      ? await regenerateSupportReplyDraftAction({ case_id: id })
      : await getSupportReplyDraftAction({ case_id: id })
    if (ticket !== requestId.current) return
    if ("error" in result) {
      setError(result.error)
      setDraft(null)
      setLoading(false)
      return
    }
    setDraft(result.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!caseId) {
      setDraft(null)
      setError(null)
      setLoading(false)
      return
    }
    void load(caseId, false)
    return () => {
      requestId.current += 1
    }
  }, [caseId, load])

  const regenerate = useCallback(() => {
    if (!caseId) return
    void load(caseId, true)
  }, [caseId, load])

  const rate = useCallback(
    async (rating: "accepted" | "rejected") => {
      if (!caseId) return
      await rateSupportReplyDraftAction({
        case_id: caseId,
        draft_id: draft?.id,
        rating,
        sent_body: draft?.body,
      })
    },
    [caseId, draft],
  )

  return { draft, loading, error, regenerate, rate }
}
