"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createEmailStudioAction,
  deleteEmailStudioAction,
  duplicateEmailStudioAction,
} from "@/lib/actions/emailStudio"
import { EMAIL_STUDIO_STARTERS } from "@/lib/email-studio/document"
import type { EmailStudioRecord } from "@/lib/types/emailStudio"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function EmailStudioLibrary({
  projects,
  templates,
}: {
  projects: EmailStudioRecord[]
  templates: EmailStudioRecord[]
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [starterId, setStarterId] = useState("blank")
  const [templateId, setTemplateId] = useState("")
  const [creating, setCreating] = useState(false)

  async function createProject() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Name the project")
      return
    }
    setCreating(true)
    const result = await createEmailStudioAction({
      name: trimmed,
      kind: "project",
      starterId: templateId ? undefined : starterId,
      templateId: templateId || undefined,
    })
    setCreating(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    router.push(`/admin/email-studio/${result.data.id}`)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">New project</h2>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <Input value={name} placeholder="Order shipped — buyer" aria-label="Project name" onChange={(event) => setName(event.target.value)} />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Starter"
            value={starterId}
            disabled={Boolean(templateId)}
            onChange={(event) => setStarterId(event.target.value)}
          >
            {EMAIL_STUDIO_STARTERS.map((starter) => (
              <option key={starter.id} value={starter.id}>{starter.name}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Saved template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Saved template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <Button disabled={creating} onClick={() => void createProject()}>{creating ? "Creating" : "Start"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {EMAIL_STUDIO_STARTERS.find((starter) => starter.id === starterId)?.description}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet. Start one from a Reswell layout above.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {projects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => router.push(`/admin/email-studio/${project.id}`)}>
                  <span className="block font-medium">{project.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {project.subject || "No subject"}
                    {project.triggerMetric ? ` · ${project.triggerMetric}` : ""}
                    {project.flowName ? ` · ${project.flowName}` : ""}
                  </span>
                </button>
                <Button size="sm" variant="outline" onClick={() => router.push(`/admin/email-studio/${project.id}`)}>Open</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void duplicateEmailStudioAction({ id: project.id }).then((result) => {
                      if ("error" in result) toast.error(result.error)
                      else {
                        toast.success("Duplicated")
                        router.refresh()
                      }
                    })
                  }}
                >
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(`Delete ${project.name}?`)) return
                    void deleteEmailStudioAction({ id: project.id }).then((result) => {
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
      </section>
    </div>
  )
}
