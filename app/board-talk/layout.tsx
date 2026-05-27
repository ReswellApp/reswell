import { createClient } from "@/lib/supabase/server"
import { BoardTalkShell } from "@/components/features/forum/board-talk-shell"

export default async function BoardTalkLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <BoardTalkShell userId={user?.id ?? null}>{children}</BoardTalkShell>
      </div>
    </main>
  )
}
