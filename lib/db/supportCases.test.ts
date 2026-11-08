import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import {
  listSupportCaseMessages,
  resetSupportCaseMessageMetadataCircuit,
} from "./supportCases.ts"

afterEach(() => {
  resetSupportCaseMessageMetadataCircuit()
})

const META_SELECT =
  "id, case_id, author_user_id, author_role, body, is_internal, metadata, created_at"
const BASE_SELECT =
  "id, case_id, author_user_id, author_role, body, is_internal, created_at"

const MESSAGE_ROW = {
  id: "msg-1",
  case_id: "case-1",
  author_user_id: null,
  author_role: "customer",
  body: "hello",
  is_internal: false,
  created_at: "2026-11-08T00:00:00.000Z",
}

function mockListClient(selects: string[]) {
  return {
    from() {
      return {
        select(columns: string) {
          selects.push(columns)
          const missing =
            columns === META_SELECT
              ? {
                  data: null,
                  error: {
                    code: "42703",
                    message: "column support_case_messages.metadata does not exist",
                  },
                }
              : { data: [MESSAGE_ROW], error: null }
          const query = {
            eq() {
              return query
            },
            order() {
              return query
            },
            limit() {
              return query
            },
            then(
              resolve: (value: typeof missing) => unknown,
              reject?: (reason: unknown) => unknown,
            ) {
              return Promise.resolve(missing).then(resolve, reject)
            },
          }
          return query
        },
      }
    },
  }
}

describe("listSupportCaseMessages metadata circuit", () => {
  it("latches after the first 42703 and uses legacy columns on later ticket opens", async () => {
    const selects: string[] = []
    const supabase = mockListClient(selects)

    const first = await listSupportCaseMessages(supabase as never, "case-1")
    const second = await listSupportCaseMessages(supabase as never, "case-1")

    assert.equal(first.length, 1)
    assert.equal(second.length, 1)
    assert.deepEqual(selects, [META_SELECT, BASE_SELECT, BASE_SELECT])
  })
})
