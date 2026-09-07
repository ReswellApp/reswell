"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

/**
 * Streams an AI-written listing description from `/api/listings/generate-description`
 * (SSE) into the caller's form state, chunk by chunk, so the seller watches the
 * description write itself instead of facing a blank textarea.
 */
export function useGeneratedListingDescription(): {
  generating: boolean
  generateDescription: (
    listingData: Record<string, unknown>,
    onText: (accumulated: string) => void,
  ) => Promise<void>
} {
  const [generating, setGenerating] = useState(false)
  const inFlightRef = useRef(false)

  const generateDescription = useCallback(
    async (
      listingData: Record<string, unknown>,
      onText: (accumulated: string) => void,
    ): Promise<void> => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setGenerating(true)
      try {
        const res = await fetch("/api/listings/generate-description", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingData }),
        })

        if (!res.ok || !res.body) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(json?.error || "Could not generate a description right now.")
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let accumulated = ""

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const events = buffer.split("\n\n")
          buffer = events.pop() ?? ""
          for (const event of events) {
            const line = event.trim()
            if (!line.startsWith("data:")) continue
            const data = line.slice(5).trim()
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data) as { text?: string; error?: string }
              if (parsed.error) throw new Error(parsed.error)
              if (parsed.text) {
                accumulated += parsed.text
                onText(accumulated)
              }
            } catch (e) {
              if (e instanceof Error && e.message && !(e instanceof SyntaxError)) throw e
            }
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not generate a description right now.")
      } finally {
        inFlightRef.current = false
        setGenerating(false)
      }
    },
    [],
  )

  return { generating, generateDescription }
}
