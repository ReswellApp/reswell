import { createClient } from "@/lib/supabase/server"
import { JamboardsLanding } from "@/components/features/marketing/jamboards-landing"
import { getBoardTalkThreadPreviews } from "@/lib/services/forumThreads"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("jamboards")
}

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
