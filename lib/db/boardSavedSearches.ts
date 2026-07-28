/**
 * @deprecated Import from `@/lib/db/savedSearches` — table renamed from
 * `board_saved_searches` → `saved_searches`.
 */
export {
  insertBoardSavedSearch,
  countBoardSavedSearchesForUser,
  fetchBoardSavedSearchesForUser,
  deleteBoardSavedSearchForUser,
  fetchBoardSavedSearchesWithEmailEnabled,
  tryInsertBoardSavedSearchAlertSent,
  type SavedSearchRow,
  type BoardSavedSearchRow,
} from "@/lib/db/savedSearches"
