export type SavedSearchSelection = {
  criteriaKey: string
  id: string | null
  /** User removed this search. Ignore a stale server id for the same criteria. */
  dismissed: boolean
}

/**
 * Keep a save the shopper just confirmed.
 * A page refresh can still report "not saved" for a moment, and a new query must
 * not inherit the previous search's id.
 */
export function nextSavedSearchSelection(
  current: SavedSearchSelection,
  criteriaKey: string,
  initialSavedSearchId: string | null,
): SavedSearchSelection {
  if (current.criteriaKey !== criteriaKey) {
    return { criteriaKey, id: initialSavedSearchId, dismissed: false }
  }
  if (current.dismissed) return current
  if (initialSavedSearchId && current.id !== initialSavedSearchId) {
    return { criteriaKey, id: initialSavedSearchId, dismissed: false }
  }
  return current
}
