"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

interface SearchFormProps {
  initialQuery?: string
}

export function SearchForm({ initialQuery = "" }: SearchFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery || searchParams.get("q") || "")

  const runSearch = useCallback(() => {
    const q = query.trim()
    if (!q) {
      router.push("/search")
      return
    }
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }, [query, router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search gear, boards, wetsuits..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11 text-base"
          autoFocus={!!initialQuery}
          aria-label="Search marketplace"
        />
      </div>
      <Button type="submit" size="default" className="h-11 px-6">
        Search
      </Button>
    </form>
  )
}
