import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import {
  isMissingSupportCaseMessageMetadataColumn,
  listSupportCaseMessages,
  resetSupportCaseMessageMetadataCircuit,
} from "./supportCases.ts"

afterEach(() => {
  resetSupportCaseMessageMetadataCircuit()
})

const MISSING_METADATA_42703 = {
  code: "42703",
  message: "column support_case_messages.metadata does not exist",
}

const MESSAGE_ROW = {
  id: "msg-1",
  case_id: "case-1",
  author_user_id: null,
  author_role: "customer",
  body: "I don't see the funds",
  is_internal: false,
  created_at: "2026-11-07T20:00:00.000Z",
}

function mockListClient(
  results: Array<{
    data?: Array<Record<string, unknown>>
    error?: { code?: string; message: string } | null
  }>,
) {
  const selects: string[] = []
  let call = 0

  const makeChain = () => {
    const settle = () => {
      const next = results[call] ?? {
        data: [],
        error: { message: "mock list exhausted" },
      }
      call += 1
      return Promise.resolve({ data: next.data ?? [], error: next.error ?? null })
    }
    const chain: {
      select: (columns: string) => unknown
      eq: () => unknown
      order: () => unknown
      limit: () => unknown
      then: (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise<unknown>
    } = {
      select(columns: string) {
        selects.push(columns)
        return chain
      },
      eq() {
        return chain
      },
      order() {
        return chain
      },
      limit() {
        return chain
      },
      then(resolve, reject) {
        return settle().then(resolve, reject)
      },
    }
    return chain
  }

  return {
    client: { from: () => makeChain() } as never,
    selects,
  }
}

describe("isMissingSupportCaseMessageMetadataColumn", () => {
  it("matches production postgres 42703 and PostgREST schema-cache misses", () => {
    assert.equal(isMissingSupportCaseMessageMetadataColumn(MISSING_METADATA_42703), true)
    assert.equal(
      isMissingSupportCaseMessageMetadataColumn({
        code: "PGRST204",
        message:
          "Could not find the 'metadata' column of 'support_case_messages' in the schema cache",
      }),
      true,
    )
    assert.equal(
      isMissingSupportCaseMessageMetadataColumn({
        message: "column support_case_messages.metadata does not exist",
      }),
      true,
    )
    assert.equal(
      isMissingSupportCaseMessageMetadataColumn({
        code: "42703",
        message: "column listings.price does not exist",
      }),
      false,
    )
    assert.equal(
      isMissingSupportCaseMessageMetadataColumn({ message: "JWT expired" }),
      false,
    )
  })
})

describe("listSupportCaseMessages metadata latch", () => {
  it("falls back once on 42703 then uses the legacy select for later loads", async () => {
    const { client, selects } = mockListClient([
      { error: MISSING_METADATA_42703 },
      { data: [MESSAGE_ROW] },
      { data: [MESSAGE_ROW] },
    ])

    const first = await listSupportCaseMessages(client, "case-1", { includeInternal: true })
    const second = await listSupportCaseMessages(client, "case-1", { includeInternal: true })

    assert.equal(first.length, 1)
    assert.equal(first[0]?.body, "I don't see the funds")
    assert.deepEqual(first[0]?.metadata, {})
    assert.equal(second.length, 1)
    assert.deepEqual(
      selects,
      [
        "id, case_id, author_user_id, author_role, body, is_internal, metadata, created_at",
        "id, case_id, author_user_id, author_role, body, is_internal, created_at",
        "id, case_id, author_user_id, author_role, body, is_internal, created_at",
      ],
    )
  })

  it("retries the metadata select after the circuit is reset", async () => {
    const { client, selects } = mockListClient([
      { error: MISSING_METADATA_42703 },
      { data: [MESSAGE_ROW] },
      { data: [{ ...MESSAGE_ROW, metadata: { attachment: { kind: "image" } } }] },
    ])

    await listSupportCaseMessages(client, "case-1")
    resetSupportCaseMessageMetadataCircuit()
    const afterReset = await listSupportCaseMessages(client, "case-1")

    assert.equal(afterReset[0]?.metadata.attachment != null, true)
    assert.equal(
      selects[0],
      "id, case_id, author_user_id, author_role, body, is_internal, metadata, created_at",
    )
    assert.equal(
      selects[2],
      "id, case_id, author_user_id, author_role, body, is_internal, metadata, created_at",
    )
  })
})
