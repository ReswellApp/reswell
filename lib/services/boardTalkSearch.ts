import { createClient } from "@/lib/supabase/server"
import {
  searchForumCommentsForSuggest,
  searchForumThreadsForSuggest,
  type ForumCommentSuggestRow,
  type ForumThreadSuggestRow,
} from "@/lib/db/forum-search"

const MAX_THREAD_SUGGEST = 8
const MAX_COMMENT_SUGGEST = 8

export type BoardTalkSearchSuggestResult = {
  threads: ForumThreadSuggestRow[]
  comments: ForumCommentSuggestRow[]
}

export async function searchBoardTalkSuggest(qRaw: string): Promise<BoardTalkSearchSuggestResult> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (q.length < 1) {
    return { threads: [], comments: [] }
  }

  const supabase = await createClient()

  const [threads, comments] = await Promise.all([
    searchForumThreadsForSuggest(supabase, q, MAX_THREAD_SUGGEST),
    searchForumCommentsForSuggest(supabase, q, MAX_COMMENT_SUGGEST),
  ])

  return { threads, comments }
}
