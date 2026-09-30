import type { EmailStudioRecord } from "@/lib/types/emailStudio"
import { EmailStudioLibrary } from "@/components/features/admin/email-studio/email-studio-library"

export function EmailStudioWorkspace({
  projects,
  templates,
  assistantEnabled,
}: {
  projects: EmailStudioRecord[]
  templates: EmailStudioRecord[]
  assistantEnabled: boolean
}) {
  return (
    <EmailStudioLibrary
      projects={projects}
      templates={templates}
      assistantEnabled={assistantEnabled}
    />
  )
}
