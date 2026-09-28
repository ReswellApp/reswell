"use client"

import { useState } from "react"
import { History } from "lucide-react"
import { toast } from "sonner"
import {
  listEmailStudioRevisionsAction,
  restoreEmailStudioRevisionAction,
} from "@/lib/actions/emailStudioCommands"
import type { EmailStudioRecord } from "@/lib/types/emailStudio"
import type { EmailStudioRevision } from "@/lib/types/emailStudioCommands"
import type { EmailStudioFlowRecord } from "@/lib/types/emailStudioFlow"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type VersionHistoryProps =
  | {
      scope: "email"
      scopeId: string
      currentRevision: number
      onRestored: (record: EmailStudioRecord) => void
    }
  | {
      scope: "flow"
      scopeId: string
      currentRevision: number
      onRestored: (record: EmailStudioFlowRecord) => void
    }

export function EmailStudioVersionHistory(props: VersionHistoryProps) {
  const { scope, scopeId, currentRevision } = props
  const [revisions, setRevisions] = useState<EmailStudioRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    const result = await listEmailStudioRevisionsAction({
      scope,
      scopeId,
      limit: 30,
    })
    setLoading(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setRevisions(result.data)
  }

  async function restore(revision: number): Promise<void> {
    setRestoring(revision)
    const result = await restoreEmailStudioRevisionAction({
      scope,
      scopeId,
      revision,
      expectedRevision: currentRevision,
    })
    setRestoring(null)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    if (props.scope === "email" && result.scope === "email" && "document" in result.data) {
      props.onRestored(result.data)
    } else if (props.scope === "flow" && result.scope === "flow" && "definition" in result.data) {
      props.onRestored(result.data)
    } else {
      toast.error("The restored version had the wrong project type.")
      return
    }
    toast.success(`Restored version ${revision}`)
    await load()
  }

  return (
    <Popover onOpenChange={(open) => {
      if (open) void load()
    }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" aria-label="Version history">
          <History className="mr-1.5 h-3.5 w-3.5" />
          History
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Version history</p>
          <p className="text-xs text-muted-foreground">Every autosave remains recoverable.</p>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {loading ? <p className="p-2 text-xs text-muted-foreground">Loading versions…</p> : null}
          {!loading && revisions.map((revision) => (
            <div key={revision.id} className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-muted">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  Version {revision.revision}
                  {revision.revision === currentRevision ? " · Current" : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {revision.summary || revision.source}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(revision.createdAt).toLocaleString()}
                </p>
              </div>
              {revision.revision !== currentRevision ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={restoring !== null}
                  onClick={() => void restore(revision.revision)}
                >
                  {restoring === revision.revision ? "Restoring" : "Restore"}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
