"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Props = {
  threadId: string
}

export function ThreadDeleteButton({ threadId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function remove() {
    if (!confirm("Delete this entire post and all comments? (Admin only — cannot be undone.)")) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from("forum_threads").delete().eq("id", threadId)
    setLoading(false)
    if (!error) {
      router.push("/board-talk")
      router.refresh()
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 text-destructive hover:text-destructive"
      disabled={loading}
      onClick={() => void remove()}
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </Button>
  )
}
