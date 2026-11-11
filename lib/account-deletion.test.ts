import assert from "node:assert/strict"
import test from "node:test"
import {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_DELETE_PATH,
  ACCOUNT_DELETED_PATH,
} from "@/lib/account-deletion"

test("account deletion destinations are stable public URLs", () => {
  assert.equal(ACCOUNT_DELETE_PATH, "/account/delete")
  assert.equal(ACCOUNT_DELETED_PATH, "/account/deleted")
  assert.equal(ACCOUNT_DELETE_CONFIRMATION, "DELETE")
})
