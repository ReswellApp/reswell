import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  bumpOpsGroup,
  findOpsGroupByFingerprint,
  findOpsSignalByExternalId,
  getOpsGroupById,
  insertOpsGroup,
  insertOpsSignal,
  type InsertOpsSignalInput,
  type UpsertOpsGroupInput,
} from "@/lib/db/ops"
import type { OpsGroupRow, OpsSeverity, OpsSource } from "@/lib/types/ops"
import {
  normalizeStackSample,
  opsFingerprint,
  opsReferenceCode,
  truncateOpsText,
} from "@/lib/utils/opsFingerprint"
import type { OpsClientReportInput } from "@/lib/validations/ops"

export type RecordOpsSignalResult = {
  group: OpsGroupRow
  signalId: string | null
  created: boolean
  duplicate: boolean
}

export type RecordOpsSignalInput = {
  source: OpsSource
  severity: OpsSeverity
  title: string
  message: string
  stackSample?: string | null
  category?: string | null
  path?: string | null
  environment?: string | null
  lastUrl?: string | null
  release?: string | null
  metadata?: Record<string, unknown>
  fingerprintParts?: Array<string | null | undefined>
  occurrenceDelta?: number
  signal?: Omit<InsertOpsSignalInput, "groupId" | "source">
}

function serviceClient() {
  return createServiceRoleClient()
}

export async function recordOpsSignal(
  input: RecordOpsSignalInput,
): Promise<RecordOpsSignalResult> {
  const supabase = serviceClient()

  if (input.signal?.externalId) {
    const existingSignal = await findOpsSignalByExternalId(
      supabase,
      input.source,
      input.signal.externalId,
    )
    if (existingSignal) {
      const group = await getOpsGroupById(supabase, existingSignal.group_id)
      if (group) {
        return {
          group,
          signalId: existingSignal.id,
          created: false,
          duplicate: true,
        }
      }
    }
  }

  const stack = normalizeStackSample(input.stackSample)
  const fingerprint = opsFingerprint(
    input.fingerprintParts ?? [
      input.source,
      input.category,
      input.path,
      input.title,
      input.message.slice(0, 160),
      stack,
    ],
  )
  const referenceCode = opsReferenceCode(fingerprint)
  const occurredAt = input.signal?.occurredAt ?? new Date().toISOString()

  const groupInput: UpsertOpsGroupInput = {
    fingerprint,
    referenceCode,
    source: input.source,
    severity: input.severity,
    title: truncateOpsText(input.title, 240),
    message: truncateOpsText(input.message, 2000),
    stackSample: truncateOpsText(stack, 8000) || null,
    category: input.category ?? null,
    path: input.path ?? null,
    environment: input.environment ?? null,
    lastUrl: input.lastUrl ?? null,
    release: input.release ?? null,
    metadata: input.metadata ?? {},
    occurredAt,
    occurrenceDelta: input.occurrenceDelta ?? 1,
  }

  let existing = await findOpsGroupByFingerprint(supabase, fingerprint)
  let created = false
  let group: OpsGroupRow

  if (!existing) {
    try {
      group = await insertOpsGroup(supabase, groupInput)
      created = true
    } catch (err) {
      // Race on unique fingerprint — retry as bump
      existing = await findOpsGroupByFingerprint(supabase, fingerprint)
      if (!existing) throw err
      group = await bumpOpsGroup(supabase, existing, groupInput)
    }
  } else {
    group = await bumpOpsGroup(supabase, existing, groupInput)
  }

  const signal = await insertOpsSignal(supabase, {
    groupId: group.id,
    source: input.source,
    externalId: input.signal?.externalId ?? null,
    userId: input.signal?.userId ?? null,
    url: input.signal?.url ?? null,
    userAgent: input.signal?.userAgent ?? null,
    digest: input.signal?.digest ?? null,
    payload: input.signal?.payload ?? {},
    occurredAt,
  })

  // Duplicate external signal: undo occurrence bump for this call if we didn't insert
  if (!signal && input.signal?.externalId && !created) {
    return {
      group,
      signalId: null,
      created: false,
      duplicate: true,
    }
  }

  return {
    group,
    signalId: signal?.id ?? null,
    created,
    duplicate: !signal && Boolean(input.signal?.externalId),
  }
}

export async function reportClientOpsError(
  raw: OpsClientReportInput,
  extras?: {
    userId?: string | null
    userAgent?: string | null
  },
): Promise<RecordOpsSignalResult> {
  const source = raw.source
  const name = raw.name?.trim() || "Error"
  const message = raw.message.trim()
  const path =
    raw.path?.trim() ||
    (raw.url
      ? (() => {
          try {
            return new URL(raw.url).pathname
          } catch {
            return raw.url.slice(0, 200)
          }
        })()
      : null)

  return recordOpsSignal({
    source,
    severity: raw.severity ?? "critical",
    title: `${name}: ${message}`.slice(0, 240),
    message,
    stackSample: raw.stack ?? null,
    category: source === "client" ? "client_exception" : "server_exception",
    path,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    lastUrl: raw.url ?? null,
    release: raw.release ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    metadata: {
      name,
      digest: raw.digest ?? null,
      context: raw.context ?? {},
    },
    fingerprintParts: [source, name, message.slice(0, 160), normalizeStackSample(raw.stack)],
    signal: {
      userId: extras?.userId ?? null,
      url: raw.url ?? null,
      userAgent: extras?.userAgent ?? null,
      digest: raw.digest ?? null,
      payload: {
        name,
        context: raw.context ?? {},
      },
    },
  })
}

/** Best-effort server capture — never throws to callers. */
export async function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    await recordOpsSignal({
      source: "server",
      severity: "critical",
      title: `${err.name}: ${err.message}`.slice(0, 240),
      message: err.message,
      stackSample: err.stack ?? null,
      category: "server_exception",
      path: typeof context?.path === "string" ? context.path : null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      metadata: { context: context ?? {} },
      fingerprintParts: [
        "server",
        err.name,
        err.message.slice(0, 160),
        normalizeStackSample(err.stack),
      ],
      signal: {
        payload: { context: context ?? {} },
      },
    })
  } catch (captureErr) {
    console.error(
      "[ops] captureException failed:",
      captureErr instanceof Error ? captureErr.message : captureErr,
    )
  }
}

export async function resolveOptionalUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}
