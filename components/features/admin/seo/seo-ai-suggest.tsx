"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface SeoAiSuggestProps {
  pageKey: string
  currentTitle: string
  currentDescription: string
  keywords?: string[]
  onApply: (suggestion: { title: string; description: string }) => void
}

/** Generates an AI title + description for the page and applies it to the draft. */
export function SeoAiSuggest({
  pageKey,
  currentTitle,
  currentDescription,
  keywords,
  onApply,
}: SeoAiSuggestProps) {
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/page-seo/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, currentTitle, currentDescription, keywords }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Could not generate")
      }
      onApply({ title: body.data.title ?? "", description: body.data.description ?? "" })
      toast.success("AI suggestion applied", { description: "Review and save if it looks good." })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate suggestion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={generate} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
      )}
      Generate with AI
    </Button>
  )
}
