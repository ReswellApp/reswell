const root = new URL("../", import.meta.url)

function isExtensionlessRelative(specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return false
  const base = specifier.split("/").pop() ?? ""
  return base.length > 0 && !base.includes(".")
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@reswell/api-contract") {
    const url = new URL("packages/api-contract/src/index.ts", root)
    return nextResolve(url.href, context)
  }
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2).replace(/\.ts$/, "")
    const url = new URL(`${relative}.ts`, root)
    return nextResolve(url.href, context)
  }
  if (isExtensionlessRelative(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      // JSON, directories, and other extensionless specifiers stay with Node.
    }
  }
  return nextResolve(specifier, context)
}
