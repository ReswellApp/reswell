import assert from "node:assert/strict"
import { register } from "node:module"
import { before, describe, it } from "node:test"

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

let savedSearchAbsoluteUrl: typeof import("./saved-search-url.ts").savedSearchAbsoluteUrl

before(async () => {
  ;({ savedSearchAbsoluteUrl } = await import("./saved-search-url.ts"))
})

const ORIGIN = "https://www.reswell.app"

describe("savedSearchAbsoluteUrl", () => {
  it("encodes a marketplace keyword search as a /search link", () => {
    assert.equal(
      savedSearchAbsoluteUrl({ q: "roberts 5'10", anySection: true }, ORIGIN),
      "https://www.reswell.app/search?q=roberts+5%2710",
    )
  })

  it("keeps a section browse search on that section", () => {
    assert.equal(
      savedSearchAbsoluteUrl({ q: "futures", section: "fins" }, ORIGIN),
      "https://www.reswell.app/fins?q=futures",
    )
  })
})
