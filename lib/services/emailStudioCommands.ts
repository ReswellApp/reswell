import "server-only"

import { EmailStudioRevisionConflictError } from "@/lib/email-studio/revision-conflict"
import {
  applyEmailStudioEmailCommands,
  applyEmailStudioFlowCommands,
  emailStudioEmailSnapshot,
  emailStudioFlowSnapshot,
  emailSnapshotRestoreCommands,
  flowSnapshotRestoreCommands,
} from "@/lib/email-studio/commands"
import {
  deleteEmailStudioDocument,
  getEmailStudioDocument,
  insertEmailStudioDocument,
  updateEmailStudioDocument,
} from "@/lib/db/emailStudio"
import { getEmailStudioFlow, updateEmailStudioFlow } from "@/lib/db/emailStudioFlows"
import {
  claimEmailStudioProposal,
  getEmailStudioProposal,
  getPendingEmailStudioProposal,
  getEmailStudioRevision,
  listEmailStudioRevisions,
  releaseEmailStudioProposalClaim,
  resolveEmailStudioProposal,
} from "@/lib/db/emailStudioRevisions"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  EMAIL_STUDIO_DOCUMENT_SCHEMA_VERSION,
  type EmailStudioRecord,
} from "@/lib/types/emailStudio"
import type {
  EmailStudioChangeSource,
  EmailStudioAssistantProposalPreview,
  EmailStudioEmailCommand,
  EmailStudioFlowCommand,
  EmailStudioRevision,
  EmailStudioScope,
} from "@/lib/types/emailStudioCommands"
import type { EmailStudioFlowRecord } from "@/lib/types/emailStudioFlow"
import type { ApplyEmailStudioCommandsInput } from "@/lib/validations/emailStudioCommands"

type ServiceError = { error: string; conflict?: boolean; currentRevision?: number }

async function requireStaff(): Promise<
  | { ok: false; error: string }
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }
  return { ok: true, userId: user.id, supabase }
}

function dbClient(userClient: Awaited<ReturnType<typeof createClient>>) {
  try {
    return createServiceRoleClient()
  } catch {
    return userClient
  }
}

async function currentRevision(
  scope: EmailStudioScope,
  scopeId: string,
  client: ReturnType<typeof dbClient>,
): Promise<number | undefined> {
  if (scope === "email") return (await getEmailStudioDocument(client, scopeId))?.revision
  return (await getEmailStudioFlow(client, scopeId))?.revision
}

export async function applyEmailStudioCommandsService(
  input: ApplyEmailStudioCommandsInput,
  source: EmailStudioChangeSource = "human",
): Promise<
  | { success: true; scope: "email"; data: EmailStudioRecord }
  | { success: true; scope: "flow"; data: EmailStudioFlowRecord }
  | ServiceError
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  const client = dbClient(staff.supabase)
  try {
    if (input.scope === "email") {
      const existing = await getEmailStudioDocument(client, input.scopeId)
      if (!existing) return { error: "Email not found" }
      const next = applyEmailStudioEmailCommands(
        emailStudioEmailSnapshot(existing),
        input.commands,
      )
      const data = await updateEmailStudioDocument(client, {
        id: existing.id,
        ...next,
        userId: staff.userId,
        expectedRevision: input.expectedRevision,
        schemaVersion: EMAIL_STUDIO_DOCUMENT_SCHEMA_VERSION,
        source,
        summary: input.summary,
        commands: input.commands,
      })
      return { success: true, scope: "email", data }
    }

    const existing = await getEmailStudioFlow(client, input.scopeId)
    if (!existing) return { error: "Flow not found" }
    if (existing.revision !== input.expectedRevision) {
      throw new EmailStudioRevisionConflictError()
    }
    const next = applyEmailStudioFlowCommands(
      emailStudioFlowSnapshot(existing),
      input.commands,
    )
    const emailCommands = input.commands.filter(
      (command): command is Extract<EmailStudioFlowCommand, { type: "flow.email.create" }> =>
        command.type === "flow.email.create",
    )
    const createdProjectIds: string[] = []
    let data: EmailStudioFlowRecord
    try {
      for (const command of emailCommands) {
        await insertEmailStudioDocument(client, {
          id: command.projectId,
          kind: "project",
          name: command.name,
          subject: command.subject,
          previewText: command.previewText,
          flowName: next.name,
          flowId: existing.id,
          triggerMetric: command.triggerMetric,
          notes: command.notes,
          document: command.document,
          userId: staff.userId,
          source,
          summary: `Created for ${next.name}`,
          commands: [command],
        })
        createdProjectIds.push(command.projectId)
      }
      data = await updateEmailStudioFlow(client, {
        id: existing.id,
        ...next,
        userId: staff.userId,
        expectedRevision: input.expectedRevision,
        source,
        summary: input.summary,
        commands: input.commands,
      })
    } catch (error) {
      await Promise.all(createdProjectIds.map(async (projectId) => {
        try {
          await deleteEmailStudioDocument(client, projectId)
        } catch (cleanupError) {
          console.error("[email_studio] proposal cleanup failed", cleanupError)
        }
      }))
      throw error
    }
    return { success: true, scope: "flow", data }
  } catch (error) {
    if (error instanceof EmailStudioRevisionConflictError) {
      return {
        error: error.message,
        conflict: true,
        currentRevision: await currentRevision(input.scope, input.scopeId, client),
      }
    }
    console.error("[email_studio] apply commands failed", error)
    return { error: error instanceof Error ? error.message : "Could not apply those changes" }
  }
}

export async function getPendingEmailStudioProposalService(
  scope: EmailStudioScope,
  scopeId: string,
): Promise<{ success: true; data: EmailStudioAssistantProposalPreview | null } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  const client = dbClient(staff.supabase)
  try {
    const proposal = await getPendingEmailStudioProposal(client, scope, scopeId)
    if (!proposal) return { success: true, data: null }
    if (proposal.status === "applying") {
      const claimedAt = proposal.claimedAt ? new Date(proposal.claimedAt).getTime() : 0
      if (Date.now() - claimedAt < 2 * 60 * 1000) {
        return { success: true, data: null }
      }
      await releaseEmailStudioProposalClaim(client, proposal.id)
    }
    if (scope === "email") {
      const existing = await getEmailStudioDocument(client, scopeId)
      if (!existing || existing.revision !== proposal.baseRevision) {
        await resolveEmailStudioProposal(client, {
          id: proposal.id,
          status: "superseded",
          userId: staff.userId,
        })
        return { success: true, data: null }
      }
      const preview = applyEmailStudioEmailCommands(
        emailStudioEmailSnapshot(existing),
        proposal.commands as EmailStudioEmailCommand[],
      )
      return {
        success: true,
        data: {
          scope: "email",
          id: proposal.id,
          baseRevision: proposal.baseRevision,
          summary: proposal.summary,
          email: {
            subject: preview.subject,
            previewText: preview.previewText,
            notes: preview.notes,
            document: preview.document,
          },
        },
      }
    }

    const existing = await getEmailStudioFlow(client, scopeId)
    if (!existing || existing.revision !== proposal.baseRevision) {
      await resolveEmailStudioProposal(client, {
        id: proposal.id,
        status: "superseded",
        userId: staff.userId,
      })
      return { success: true, data: null }
    }
    const preview = applyEmailStudioFlowCommands(
      emailStudioFlowSnapshot(existing),
      proposal.commands as EmailStudioFlowCommand[],
    )
    return {
      success: true,
      data: {
        scope: "flow",
        id: proposal.id,
        baseRevision: proposal.baseRevision,
        summary: proposal.summary,
        flow: preview,
      },
    }
  } catch (error) {
    console.error("[email_studio] load pending proposal failed", error)
    return { error: "Could not load the pending assistant proposal" }
  }
}

export async function listEmailStudioRevisionsService(
  scope: EmailStudioScope,
  scopeId: string,
  limit?: number,
): Promise<{ success: true; data: EmailStudioRevision[] } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const data = await listEmailStudioRevisions(
      dbClient(staff.supabase),
      scope,
      scopeId,
      limit,
    )
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] list revisions failed", error)
    return { error: "Could not load version history" }
  }
}

export async function restoreEmailStudioRevisionService(input: {
  scope: EmailStudioScope
  scopeId: string
  revision: number
  expectedRevision: number
}) {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  const revision = await getEmailStudioRevision(
    dbClient(staff.supabase),
    input.scope,
    input.scopeId,
    input.revision,
  )
  if (!revision) return { error: "Version not found" }
  if (revision.scope === "email") {
    return applyEmailStudioCommandsService({
      scope: "email",
      scopeId: input.scopeId,
      expectedRevision: input.expectedRevision,
      summary: `Restored version ${input.revision}`,
      commands: emailSnapshotRestoreCommands(revision.snapshot),
    }, "restore")
  }
  return applyEmailStudioCommandsService({
    scope: "flow",
    scopeId: input.scopeId,
    expectedRevision: input.expectedRevision,
    summary: `Restored version ${input.revision}`,
    commands: flowSnapshotRestoreCommands(revision.snapshot),
  }, "restore")
}

export async function resolveEmailStudioProposalService(input: {
  proposalId: string
  decision: "accept" | "reject"
  expectedRevision?: number
}) {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  const client = dbClient(staff.supabase)
  let claimedProposalId: string | null = null
  try {
    const proposal = await getEmailStudioProposal(client, input.proposalId)
    if (!proposal) return { error: "Proposal not found" }
    if (proposal.status !== "pending") return { error: "This proposal was already resolved." }
    if (input.decision === "reject") {
      const rejected = await resolveEmailStudioProposal(client, {
        id: proposal.id,
        status: "rejected",
        userId: staff.userId,
      })
      if (!rejected) return { error: "This proposal was already resolved." }
      return { success: true as const, status: "rejected" as const }
    }

    const claimed = await claimEmailStudioProposal(client, proposal.id, staff.userId)
    if (!claimed) return { error: "This proposal was already resolved." }
    claimedProposalId = proposal.id
    const expectedRevision = input.expectedRevision ?? proposal.baseRevision
    const result = proposal.scope === "email"
      ? await applyEmailStudioCommandsService({
          scope: "email",
          scopeId: proposal.scopeId,
          expectedRevision,
          summary: proposal.summary,
          commands: proposal.commands as EmailStudioEmailCommand[],
        }, "assistant")
      : await applyEmailStudioCommandsService({
          scope: "flow",
          scopeId: proposal.scopeId,
          expectedRevision,
          summary: proposal.summary,
          commands: proposal.commands as EmailStudioFlowCommand[],
        }, "assistant")
    if ("error" in result) {
      await resolveEmailStudioProposal(client, {
        id: proposal.id,
        status: "superseded",
        userId: staff.userId,
      })
      claimedProposalId = null
      return result
    }
    const accepted = await resolveEmailStudioProposal(client, {
      id: proposal.id,
      status: "accepted",
      userId: staff.userId,
      acceptedRevision: result.data.revision,
    })
    if (accepted) {
      claimedProposalId = null
    } else {
      await releaseEmailStudioProposalClaim(client, proposal.id)
      claimedProposalId = null
    }
    return {
      success: true as const,
      status: "accepted" as const,
      scope: result.scope,
      data: result.data,
      warning: accepted ? null : "Changes saved; proposal audit status is still applying.",
    }
  } catch (error) {
    if (claimedProposalId) {
      try {
        await releaseEmailStudioProposalClaim(client, claimedProposalId)
      } catch (releaseError) {
        console.error("[email_studio] release proposal claim failed", releaseError)
      }
    }
    console.error("[email_studio] resolve proposal failed", error)
    return { error: "Could not resolve this proposal" }
  }
}
