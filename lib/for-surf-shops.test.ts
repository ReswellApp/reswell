import assert from "node:assert/strict"
import { register } from "node:module"
import { describe, it } from "node:test"

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { pathToFileURL } from "node:url"
import { join } from "node:path"
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = join(${JSON.stringify("/workspace")}, specifier.slice(2))
    const file = abs.endsWith(".ts") ? abs : abs + ".ts"
    return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
`),
)

const { FOR_SURF_SHOPS_FAQS, FOR_SURF_SHOPS_PATH, forSurfShopsAccountHref, forSurfShopsAccountLabel } =
  await import("./for-surf-shops.ts")
const { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } = await import("./seller-fees.ts")

describe("forSurfShopsAccountHref", () => {
  it("sends signed-out shops to sign-up, then into a new board listing", () => {
    assert.equal(
      forSurfShopsAccountHref(false),
      "/auth/sign-up?redirect=%2Fsell%2Fboards%3Fnew%3D1",
    )
    assert.equal(forSurfShopsAccountLabel(false), "Create a free account")
  })

  it("sends signed-in shops straight to a new board listing", () => {
    assert.equal(forSurfShopsAccountHref(true), "/sell/boards?new=1")
    assert.equal(forSurfShopsAccountLabel(true), "List a used board")
  })
})

describe("FOR_SURF_SHOPS_FAQS", () => {
  it("states the live marketplace fee and the public path", () => {
    assert.equal(FOR_SURF_SHOPS_PATH, "/for-surf-shops")
    const fee = FOR_SURF_SHOPS_FAQS.find((item) => item.question.includes("cost"))
    assert.ok(fee)
    assert.match(fee.answer, new RegExp(`${MARKETPLACE_FEE_PERCENT}%`))
    assert.match(fee.answer, new RegExp(`${SELLER_SHARE_PERCENT}%`))
  })
})
