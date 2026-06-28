import { createClient } from "@/lib/supabase/server"
import {
  searchForumCommentsForSuggest,
  searchForumThreadsForSuggest,
  type ForumCommentSuggestRow,
  type ForumThreadSuggestRow,
} from "@/lib/db/forum-search"
import { fetchForumThreadsByIds } from "@/lib/db/forum-threads"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchForumThreadIdsFromElasticsearch } from "@/lib/elasticsearch/forum-threads-index"

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

  let threads: ForumThreadSuggestRow[] = []
  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchForumThreadIdsFromElasticsearch(q, MAX_THREAD_SUGGEST)
      if (ids.length > 0) {
        const rows = await fetchForumThreadsByIds(supabase, ids)
        threads = rows.map((t) => ({ id: t.id, title: t.title, slug: t.slug }))
      }
    } catch (err) {
      console.error("[boardTalkSearch] Elasticsearch thread suggest failed, using Supabase:", err)
      threads = await searchForumThreadsForSuggest(supabase, q, MAX_THREAD_SUGGEST)
    }
  } else {
    threads = await searchForumThreadsForSuggest(supabase, q, MAX_THREAD_SUGGEST)
  }

  const comments = await searchForumCommentsForSuggest(supabase, q, MAX_COMMENT_SUGGEST)

  return { threads, comments }
}
