"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createEmailStudioFlowAction, deleteEmailStudioFlowAction } from "@/lib/actions/emailStudioFlows"
import type { EmailStudioFlowRecord } from "@/lib/types/emailStudioFlow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function EmailStudioFlowLibrary({ flows }: { flows: EmailStudioFlowRecord[] }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  async function create() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Name the flow")
      return
    }
    setCreating(true)
    const result = await createEmailStudioFlowAction({ name: trimmed })
    setCreating(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    router.push(`/admin/email-studio/flows/${result.data.id}`)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap gap-2">
        <Input value={name} placeholder="Abandoned checkout" aria-label="Flow name" className="max-w-sm" onChange={(event) => setName(event.target.value)} />
        <Button disabled={creating} onClick={() => void create()}>{creating ? "Creating" : "New flow"}</Button>
      </section>
      {flows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No flows yet. Start one, or ask the assistant inside an email.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {flows.map((flow) => (
            <li key={flow.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <Link href={`/admin/email-studio/flows/${flow.id}`} className="min-w-0 flex-1">
                <span className="block font-medium">{flow.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {flow.definition.steps.length} actions
                  {flow.klaviyoFlowId ? ` · Klaviyo ${flow.klaviyoStatus || "draft"}` : " · not pushed"}
                </span>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!window.confirm(`Delete ${flow.name}? This does not archive it in Klaviyo.`)) return
                  void deleteEmailStudioFlowAction({ id: flow.id }).then((result) => {
                    if ("error" in result) toast.error(result.error)
                    else router.refresh()
                  })
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
