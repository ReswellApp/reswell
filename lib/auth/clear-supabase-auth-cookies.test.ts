import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isInvalidRefreshTokenError,
  isNonFatalGetUserError,
  isRefreshTokenAlreadyUsedError,
} from "./clear-supabase-auth-cookies.ts"

describe("refresh token already used", () => {
  it("matches GoTrue's reuse error without treating it as a dead token", () => {
    const error = {
      name: "AuthApiError",
      code: "refresh_token_already_used",
      message: "Invalid Refresh Token: Already Used",
    }

    assert.equal(isRefreshTokenAlreadyUsedError(error), true)
    assert.equal(isInvalidRefreshTokenError(error), false)
    assert.equal(isNonFatalGetUserError(error), true)
  })

  it("matches the message when the code is missing", () => {
    assert.equal(
      isRefreshTokenAlreadyUsedError(
        new Error("Invalid Refresh Token: Already Used"),
      ),
      true,
    )
  })

  it("still treats a missing refresh token as dead", () => {
    const error = { code: "refresh_token_not_found", message: "Invalid Refresh Token" }
    assert.equal(isInvalidRefreshTokenError(error), true)
    assert.equal(isRefreshTokenAlreadyUsedError(error), false)
  })
})
