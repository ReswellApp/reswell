import { createClient } from "@/lib/supabase/server"
import { JamboardsLanding } from "@/components/features/marketing/jamboards-landing"
import { getBoardTalkThreadPreviews } from "@/lib/services/forumThreads"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Jamboards Alternative — Reswell community",
  description:
    "Jamboards Alternative is where surfers connect on Reswell — browse Board Talk conversations, share stoke, and jump into community discussions.",
  path: "/jamboards",
})

export const dynamic = "force-dynamic"

const PREVIEW_THREAD_LIMIT = 5

export default async function JamboardsPage() {
  const supabase = await createClient()

  const [
    threads,
    {
      data: { user },
    },
  ] = await Promise.all([
    getBoardTalkThreadPreviews(supabase, PREVIEW_THREAD_LIMIT),
    supabase.auth.getUser(),
  ])

  return <JamboardsLanding threads={threads} userId={user?.id ?? null} />
}
