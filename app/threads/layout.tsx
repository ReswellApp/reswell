import { createClient } from "@/lib/supabase/server"
import { BoardTalkShell } from "@/components/features/forum/board-talk-shell"

export default async function BoardTalkLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let displayName: string | null = null
  let avatarUrl: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
    displayName = profile?.display_name ?? null
    avatarUrl = profile?.avatar_url ?? null
  }

  return (
    <main className="flex-1">
      <BoardTalkShell
        userId={user?.id ?? null}
        displayName={displayName}
        avatarUrl={avatarUrl}
      >
        {children}
      </BoardTalkShell>
    </main>
  )
}
