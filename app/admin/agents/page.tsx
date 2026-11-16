import { privatePageMetadata } from "@/lib/site-metadata"
import { WorkforceAgentsAdminClient } from "@/components/features/admin/agents/workforce-agents-admin-client"
import { getWorkforceAgentsAdminPage } from "@/lib/services/workforceAgents"

export const metadata = privatePageMetadata({
  title: "Workforce agents — Admin",
  description: "Turn Reswell growth and ops LLM agents on or off.",
  path: "/admin/agents",
})

export default async function AdminWorkforceAgentsPage() {
  const result = await getWorkforceAgentsAdminPage()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Workforce agents
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your solo-founder agent crew for shop outreach, supply, ads, and ops. Flip each one on
          when you are ready for it to run.
        </p>
      </div>

      {!result.ok ? (
        <p className="text-sm text-destructive">{result.error}</p>
      ) : (
        <WorkforceAgentsAdminClient agents={result.data.agents} />
      )}
    </div>
  )
}
