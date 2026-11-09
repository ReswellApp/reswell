import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

const ROUTER_FILES = [
  "node_modules/next/dist/client/components/app-router.js",
  "node_modules/next/dist/esm/client/components/app-router.js",
]

function sliceFunction(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.ok(from >= 0 && to > from, `missing ${start} .. ${end}`)
  return source.slice(from, to)
}

describe("Next.js App Router hook order", () => {
  for (const relativePath of ROUTER_FILES) {
    it(`${relativePath} keeps the action queue off the useMemo fiber`, () => {
      const source = readFileSync(path.join(root, relativePath), "utf8")
      const router = sliceFunction(source, "function Router(", "function RouterContent(")
      const content = sliceFunction(source, "function RouterContent(", "function AppRouter(")

      assert.match(router, /useActionQueue/)
      assert.equal(router.includes("useMemo("), false)
      assert.equal(router.includes(".useMemo)"), false)
      assert.equal(router.includes("mpaNavigation"), false)

      const throwAt = content.lastIndexOf("unresolvedThenable")
      const lastHook = Math.max(
        content.lastIndexOf("useMemo("),
        content.lastIndexOf(".useMemo)"),
        content.lastIndexOf("useEffect("),
        content.lastIndexOf(".useEffect)"),
      )
      assert.ok(throwAt > lastHook, "mpaNavigation throw must follow every hook")

      const afterThrow = content.slice(throwAt)
      assert.equal(/useMemo\(|\.useMemo\)|useEffect\(|\.useEffect\)/.test(afterThrow), false)
      assert.match(content, /throw [\w.]+\s*;\n\s+\}/)
    })
  }
})
