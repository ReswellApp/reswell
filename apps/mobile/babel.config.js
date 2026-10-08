const { loadRepoEnv } = require("./load-root-env")

const PUBLIC_KEYS = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_URL",
])

function inlineNextPublicEnv({ types: t }) {
  return {
    name: "inline-next-public-env",
    visitor: {
      MemberExpression(path) {
        const node = path.node
        if (node.computed || !t.isIdentifier(node.property) || !PUBLIC_KEYS.has(node.property.name)) return
        const env = node.object
        if (!t.isMemberExpression(env) || env.computed || !t.isIdentifier(env.property, { name: "env" })) return
        if (!t.isIdentifier(env.object, { name: "process" })) return
        path.replaceWith(t.stringLiteral(process.env[node.property.name] ?? ""))
      },
    },
  }
}

module.exports = function (api) {
  loadRepoEnv()
  api.cache.using(() =>
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_URL"]
      .map((key) => process.env[key] ?? "")
      .join("\0"),
  )
  return {
    presets: ["babel-preset-expo"],
    plugins: [inlineNextPublicEnv],
  }
}
