import { createClient } from "@/lib/supabase/server"
import { BoardTalkShell } from "@/components/features/forum/board-talk-shell"
import { countForumUnreadRepliesForUser } from "@/lib/db/forum-notifications-inbox"

export default async function BoardTalkLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let displayName: string | null = null
  let avatarUrl: string | null = null
  let threadsUnreadReplies = 0

  if (user) {
    const [{ data: profile }, unreadReplies] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      countForumUnreadRepliesForUser(user.id),
    ])
    displayName = profile?.display_name ?? null
    avatarUrl = profile?.avatar_url ?? null
    threadsUnreadReplies = unreadReplies
  }

  return (
    <main className="flex-1">
      <BoardTalkShell
        userId={user?.id ?? null}
        displayName={displayName}
        avatarUrl={avatarUrl}
        email={user?.email ?? null}
        threadsUnreadReplies={threadsUnreadReplies}
      >
        {children}
      </BoardTalkShell>
    </main>
  )
}
