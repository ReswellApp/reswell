"use client"

import { useEffect } from "react"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { NewThreadForm } from "@/components/forum/new-thread-form"
import { createClient } from "@/lib/supabase/client"

export function NewThreadPageClient() {
  const authModal = useAuthModal()

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        authModal.openLogin("/threads/new")
      }
    })()
  }, [authModal])

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="text-2xl font-bold text-foreground sm:text-3xl">New topic</h2>
      <p className="mt-2 mb-8 text-muted-foreground">
        Kick off a conversation — links, questions, and stories welcome.
      </p>
      <NewThreadForm />
    </div>
  )
}
