import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NewThreadForm } from "@/components/forum/new-thread-form"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "New post — Board Talk · Reswell",
  description: "Start a new discussion in Board Talk — questions, gear talk, and community topics.",
  path: "/board-talk/new",
  robots: { index: false, follow: false },
})

export default async function NewThreadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/board-talk/new")}`)
  }

  return (
    <>
      <Link href="/board-talk" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
        ← Board Talk
      </Link>
      <h2 className="mt-4 text-3xl font-bold text-foreground">New post</h2>
      <p className="mt-2 mb-8 text-muted-foreground">Start something new for the community.</p>
      <NewThreadForm />
    </>
  )
}
