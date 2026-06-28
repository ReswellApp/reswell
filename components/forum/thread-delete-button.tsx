"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { deleteForumThreadAction } from "@/app/actions/forum"

type Props = {
  threadId: string
}

export function ThreadDeleteButton({ threadId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function remove() {
    if (!confirm("Delete this entire post and all comments? This cannot be undone.")) return
    setLoading(true)
    const result = await deleteForumThreadAction(threadId)
    setLoading(false)
    if ("success" in result && result.success) {
      toast.success("Post deleted")
      router.push("/threads")
      router.refresh()
      return
    }
    toast.error("error" in result ? result.error : "Could not delete this post.")
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
      {loading ? "Deleting…" : "Delete"}
    </Button>
  )
}
