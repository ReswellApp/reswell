import { z } from 'zod'
import {
  CURSOR_AGENT_STATUSES,
  CURSOR_RUN_STATUSES,
  type CursorAgentStatus,
  type CursorRunStatus,
} from '@/lib/types/reswellTickets'

const CURSOR_API_BASE = 'https://api.cursor.com'
const REQUEST_TIMEOUT_MS = 30_000

const agentStatusSchema = z.enum(CURSOR_AGENT_STATUSES)
const runStatusSchema = z
  .string()
  .transform((value): CursorRunStatus | null =>
    (CURSOR_RUN_STATUSES as readonly string[]).includes(value)
      ? (value as CursorRunStatus)
      : null,
  )

const createAgentResponseSchema = z.object({
  agent: z.object({
    id: z.string().min(1),
    status: agentStatusSchema,
    url: z.string().url(),
    latestRunId: z.string().min(1).optional(),
  }),
  run: z
    .object({
      id: z.string().min(1),
      status: runStatusSchema.nullable(),
    })
    .optional(),
})

const getAgentResponseSchema = z.object({
  id: z.string().min(1),
  status: agentStatusSchema,
  url: z.string().url(),
  latestRunId: z.string().min(1).optional().nullable(),
})

const getRunResponseSchema = z.object({
  id: z.string().min(1),
  status: runStatusSchema.nullable(),
  result: z.string().optional(),
  git: z
    .object({
      branches: z
        .array(
          z.object({
            repoUrl: z.string().optional(),
            branch: z.string().optional(),
            prUrl: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
})

const createRunResponseSchema = z.object({
  run: z.object({
    id: z.string().min(1),
    status: runStatusSchema.nullable(),
  }),
})

export class CursorCloudAgentError extends Error {
  readonly statusCode: number
  readonly expose: boolean

  constructor(message: string, statusCode: number, expose = true) {
    super(message)
    this.name = 'CursorCloudAgentError'
    this.statusCode = statusCode
    this.expose = expose
  }
}

export interface CursorAgentSnapshot {
  agentId: string
  agentUrl: string
  agentStatus: CursorAgentStatus
  runId: string | null
  runStatus: CursorRunStatus | null
  prUrl: string | null
}

export interface CreateCursorAgentInput {
  promptText: string
  imageUrls?: string[]
  name: string
}

function cursorApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim()
  if (!key) {
    throw new CursorCloudAgentError(
      'Cursor is not configured. Add CURSOR_API_KEY in the server environment.',
      501,
    )
  }
  return key
}

function repoUrl(): string {
  return (
    process.env.CURSOR_CLOUD_AGENT_REPO_URL?.trim() ||
    'https://github.com/ReswellApp/reswell'
  )
}

function startingRef(): string {
  return process.env.CURSOR_CLOUD_AGENT_STARTING_REF?.trim() || 'main'
}

function autoCreatePr(): boolean {
  return process.env.CURSOR_CLOUD_AGENT_AUTO_CREATE_PR !== 'false'
}

function authorizationHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`, 'utf8').toString('base64')}`
}

function promptImages(imageUrls: string[] | undefined): { url: string }[] | undefined {
  if (!imageUrls || imageUrls.length === 0) return undefined
  return imageUrls.slice(0, 5).map((url) => ({ url }))
}

async function cursorFetch(path: string, init: RequestInit): Promise<unknown> {
  const apiKey = cursorApiKey()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${CURSOR_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: authorizationHeader(apiKey),
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })

    const raw: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      throw mapCursorHttpError(response.status, raw)
    }
    return raw
  } catch (error) {
    if (error instanceof CursorCloudAgentError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CursorCloudAgentError('Cursor did not respond in time. Try again.', 504)
    }
    console.error('[cursor-cloud-agent] request failed', {
      path,
      timestamp: new Date().toISOString(),
    })
    throw new CursorCloudAgentError('Could not reach Cursor. Try again.', 502)
  } finally {
    clearTimeout(timer)
  }
}

function mapCursorHttpError(status: number, body: unknown): CursorCloudAgentError {
  const code = extractCursorErrorCode(body)
  if (status === 401 || status === 403) {
    return new CursorCloudAgentError('Cursor API key is invalid or missing permission.', 502)
  }
  if (status === 409 && code === 'agent_busy') {
    return new CursorCloudAgentError(
      'The Cursor agent is still working. Wait for this run to finish, then send a follow-up.',
      409,
    )
  }
  if (status === 409 && code === 'agent_id_conflict') {
    return new CursorCloudAgentError('That Cursor agent already exists.', 409)
  }
  if (status === 429) {
    return new CursorCloudAgentError('Cursor is rate limited. Try again shortly.', 429)
  }
  if (status === 404) {
    return new CursorCloudAgentError('Cursor agent not found.', 404)
  }
  console.error('[cursor-cloud-agent] API error', {
    status,
    code,
    timestamp: new Date().toISOString(),
  })
  return new CursorCloudAgentError('Cursor could not start or update the agent.', 502)
}

function extractCursorErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  if ('error' in body && typeof body.error === 'string') return body.error
  if (
    'error' in body &&
    body.error &&
    typeof body.error === 'object' &&
    'code' in body.error &&
    typeof body.error.code === 'string'
  ) {
    return body.error.code
  }
  return null
}

export async function createCursorCloudAgent(
  input: CreateCursorAgentInput,
): Promise<CursorAgentSnapshot> {
  const raw = await cursorFetch('/v1/agents', {
    method: 'POST',
    body: JSON.stringify({
      prompt: {
        text: input.promptText,
        images: promptImages(input.imageUrls),
      },
      name: input.name.slice(0, 100),
      repos: [
        {
          url: repoUrl(),
          startingRef: startingRef(),
        },
      ],
      autoCreatePR: autoCreatePr(),
    }),
  })

  const parsed = createAgentResponseSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[cursor-cloud-agent] unexpected create response')
    throw new CursorCloudAgentError('Cursor returned an unexpected response.', 502)
  }

  return {
    agentId: parsed.data.agent.id,
    agentUrl: parsed.data.agent.url,
    agentStatus: parsed.data.agent.status,
    runId: parsed.data.run?.id ?? parsed.data.agent.latestRunId ?? null,
    runStatus: parsed.data.run?.status ?? null,
    prUrl: null,
  }
}

export async function getCursorCloudAgent(agentId: string): Promise<CursorAgentSnapshot> {
  const raw = await cursorFetch(`/v1/agents/${encodeURIComponent(agentId)}`, {
    method: 'GET',
  })
  const parsed = getAgentResponseSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[cursor-cloud-agent] unexpected get agent response')
    throw new CursorCloudAgentError('Cursor returned an unexpected response.', 502)
  }

  const runId = parsed.data.latestRunId ?? null
  if (!runId) {
    return {
      agentId: parsed.data.id,
      agentUrl: parsed.data.url,
      agentStatus: parsed.data.status,
      runId: null,
      runStatus: null,
      prUrl: null,
    }
  }

  const run = await getCursorCloudAgentRun(parsed.data.id, runId)
  return {
    agentId: parsed.data.id,
    agentUrl: parsed.data.url,
    agentStatus: parsed.data.status,
    runId: run.id,
    runStatus: run.status,
    prUrl: run.prUrl,
  }
}

export async function getCursorCloudAgentRun(
  agentId: string,
  runId: string,
): Promise<{ id: string; status: CursorRunStatus | null; prUrl: string | null }> {
  const raw = await cursorFetch(
    `/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
    { method: 'GET' },
  )
  const parsed = getRunResponseSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[cursor-cloud-agent] unexpected get run response')
    throw new CursorCloudAgentError('Cursor returned an unexpected response.', 502)
  }

  const prUrl =
    parsed.data.git?.branches
      ?.map((branch) => branch.prUrl)
      .find((url) => Boolean(url?.startsWith('http'))) ?? null

  return {
    id: parsed.data.id,
    status: parsed.data.status,
    prUrl,
  }
}

export async function createCursorCloudAgentFollowUp(
  agentId: string,
  text: string,
  imageUrls?: string[],
): Promise<CursorAgentSnapshot> {
  const raw = await cursorFetch(`/v1/agents/${encodeURIComponent(agentId)}/runs`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: {
        text,
        images: promptImages(imageUrls),
      },
    }),
  })
  const parsed = createRunResponseSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[cursor-cloud-agent] unexpected follow-up response')
    throw new CursorCloudAgentError('Cursor returned an unexpected response.', 502)
  }

  const agent = await getCursorCloudAgent(agentId)
  return {
    ...agent,
    runId: parsed.data.run.id,
    runStatus: parsed.data.run.status,
  }
}
