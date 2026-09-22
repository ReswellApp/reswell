"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { SellersDirectorySearch } from "@/components/sellers/sellers-directory-search"

type SellersDirectoryQueryState = {
  query: string
  setQuery: (next: string) => void
}

const SellersDirectoryQueryContext = createContext<SellersDirectoryQueryState>({
  query: "",
  setQuery: () => {},
})

export function useSellersDirectoryQuery(): SellersDirectoryQueryState {
  return useContext(SellersDirectoryQueryContext)
}

function directorySearchPath(term: string): string {
  const trimmed = term.trim()
  if (!trimmed) return "/sellers"
  return `/sellers?q=${encodeURIComponent(trimmed)}`
}

/**
 * Directory search stays in the browser so `/sellers` can be one cached document.
 * `?q=` is mirrored in the address bar without a server navigation.
 */
export function SellersDirectoryQueryProvider({ children }: { children: ReactNode }) {
  const [query, setQueryState] = useState("")

  useEffect(() => {
    const term = new URLSearchParams(window.location.search).get("q")?.trim() ?? ""
    if (term) setQueryState(term)
  }, [])

  const setQuery = useCallback((next: string) => {
    const term = next.trim()
    setQueryState(term)
    window.history.replaceState(window.history.state, "", directorySearchPath(term))
  }, [])

  return (
    <SellersDirectoryQueryContext.Provider value={{ query, setQuery }}>
      {children}
    </SellersDirectoryQueryContext.Provider>
  )
}

export function SellersDirectorySearchField({ className }: { className?: string }) {
  const { query, setQuery } = useSellersDirectoryQuery()
  return (
    <SellersDirectorySearch
      directoryQuery={query}
      onDirectoryQuery={setQuery}
      className={className}
    />
  )
}
