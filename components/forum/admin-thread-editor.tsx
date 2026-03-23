"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"

type Props = {
  threadId: string
  initialTitle: string
  initialBody: string
}

export function AdminThreadEditor({ threadId, initialTitle, initialBody }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setBody(initialBody)
      setError(null)
    }
  }, [open, initialTitle, initialBody])

  async function save() {
    setError(null)
    const t = title.trim()
    const b = body.trim()
    if (!t) {
      setError("Title is required.")
      return
    }
    if (!b) {
      setError("Description is required.")
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: upErr } = await supabase
      .from("forum_threads")
      .update({ title: t, body: b, updated_at: new Date().toISOString() })
      .eq("id", threadId)
    setSaving(false)
    if (upErr) {
      setError(upErr.message || "Could not save.")
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription>Admin: changes apply to this post for all users.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={`admin-thread-title-${threadId}`}>Title</Label>
            <Input
              id={`admin-thread-title-${threadId}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`admin-thread-body-${threadId}`}>Description</Label>
            <Textarea
              id={`admin-thread-body-${threadId}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[180px] resize-y"
              maxLength={12000}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
