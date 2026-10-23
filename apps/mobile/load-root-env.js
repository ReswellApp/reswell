const fs = require("fs")
const path = require("path")

const repoRoot = path.resolve(__dirname, "../..")

/**
 * Load the website env into this process. Highest-priority file wins.
 * Existing shell variables are left alone, matching Next.js.
 */
function loadRepoEnv() {
  const nodeEnv = process.env.NODE_ENV || "development"
  const files =
    nodeEnv === "test"
      ? [`.env.${nodeEnv}`, ".env"]
      : [`.env.${nodeEnv}.local`, ".env.local", `.env.${nodeEnv}`, ".env"]

  for (const name of files) {
    const file = path.join(repoRoot, name)
    if (!fs.existsSync(file)) continue
    process.loadEnvFile(file)
  }
}

module.exports = { loadRepoEnv }
