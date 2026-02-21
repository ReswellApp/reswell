"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Languages, Loader2, RotateCcw } from "lucide-react"

interface TranslateableDescriptionProps {
  text: string
  className?: string
}

export function TranslateableDescription({ text, className = "" }: TranslateableDescriptionProps) {
  const [translated, setTranslated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayText = translated ?? text
  const isEmpty = !text || text.trim() === ""

  const handleTranslate = async () => {
    if (translated) {
      setTranslated(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: "en" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Translation failed")
      setTranslated(data.translated || "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed")
    } finally {
      setLoading(false)
    }
  }

  if (isEmpty) {
    return <p className={`text-muted-foreground ${className}`}>No description provided.</p>
  }

  return (
    <div>
      <p className={`text-muted-foreground whitespace-pre-wrap ${className}`}>{displayText}</p>
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 gap-2 text-muted-foreground hover:text-foreground"
        onClick={handleTranslate}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : translated ? (
          <>
            <RotateCcw className="h-4 w-4" />
            Show original
          </>
        ) : (
          <>
            <Languages className="h-4 w-4" />
            Translate to English
          </>
        )}
      </Button>
    </div>
  )
}
