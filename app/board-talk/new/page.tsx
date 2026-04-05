import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NewThreadForm } from "@/components/forum/new-thread-form"

export const metadata: Metadata = {
  title: "New post · Board Talk",
}

export default async function NewThreadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/board-talk/new")}`)
  }

  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-2xl py-10 px-4">
        <Link href="/board-talk" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
          ← Board Talk
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">New post</h1>
        <p className="mt-2 text-muted-foreground mb-8">Start something new for the community.</p>
        <NewThreadForm />
      </div>
    </main>
  )
}
