import { register } from "node:module"
import { pathToFileURL } from "node:url"

const root = new URL("../", import.meta.url)

register(new URL("./test-alias-hooks.mjs", import.meta.url), { parentURL: pathToFileURL(root.pathname) })
