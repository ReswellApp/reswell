import type { CaseInboxView } from "./case-inbox"

export const INBOX_PAGE_SIZE = 50
export const INBOX_OPEN_QUEUE_CAP = 200
export const INBOX_SEARCH_MATCH_CAP = 80

export function inboxQueryUsesHistory(search: string, view: CaseInboxView): boolean {
  return search.trim().length > 0 || view === "resolved" || view === "all"
}
