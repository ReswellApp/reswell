"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"

interface SearchFormProps {
  initialQuery?: string
  /** Optional section for suggestions: "used" | "surfboards" */
  section?: string
  /** Callback when a search is run (e.g. to close nav popover) */
  onSearch?: () => void
  /** Auto-focus the input when mounted (e.g. in nav popover) */
  autoFocus?: boolean
}

export function SearchForm({ initialQuery = "", section = "", onSearch, autoFocus = false }: SearchFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery || searchParams.get("q") || "")

  const runSearch = useCallback(
    (q?: string) => {
      const term = (q ?? query).trim()
      if (!term) {
        router.push("/search")
        onSearch?.()
        return
      }
      router.push(`/search?q=${encodeURIComponent(term)}`)
      onSearch?.()
    },
    [query, router, onSearch]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch()
  }

  const handleSelect = useCallback(
    (text: string) => {
      setQuery(text)
      runSearch(text)
    },
    [runSearch]
  )

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="relative flex-1">
        <SearchInputWithSuggest
          value={query}
          onChange={setQuery}
          onSelect={handleSelect}
          placeholder="Search gear, boards, wetsuits, fins..."
          section={section}
          leftIcon={<Search className="h-4 w-4" />}
          inputClassName="h-12 text-base rounded-xl border-border bg-background"
          listboxId="search-suggestions"
          className="w-full"
          autoFocus={autoFocus || !!initialQuery}
        />
      </div>
      <Button type="submit" size="default" className="h-12 rounded-xl px-6 font-medium">
        Search
      </Button>
    </form>
  )
}
