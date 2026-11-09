import * as SecureStore from "expo-secure-store"

const KEY = "reswell.recent-searches"
const MAX_SEARCHES = 8

export async function readRecentSearches(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 1)
      .slice(0, MAX_SEARCHES)
  } catch {
    return []
  }
}

export async function rememberSearch(query: string): Promise<string[]> {
  const next = query.trim()
  if (next.length < 2) return readRecentSearches()
  const current = await readRecentSearches()
  const saved = [next, ...current.filter((item) => item.toLowerCase() !== next.toLowerCase())].slice(0, MAX_SEARCHES)
  await SecureStore.setItemAsync(KEY, JSON.stringify(saved))
  return saved
}
