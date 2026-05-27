"use server"

import { searchBoardTalkSuggest } from "@/lib/services/boardTalkSearch"
import type { BoardTalkSearchSuggestResult } from "@/lib/services/boardTalkSearch"

export async function searchBoardTalkCatalogSuggest(
  qRaw: string,
): Promise<BoardTalkSearchSuggestResult> {
  return searchBoardTalkSuggest(qRaw)
}
