import "@/lib/klaviyo/bootstrap-env"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { NextResponse } from "next/server"

/**
 * Safe debug: confirms the server sees KLAVIYO_API_KEY (boolean only, no key material).
 */
export async function GET() {
  const cwd = process.cwd()
  const envLocal = join(cwd, ".env.local")
  const raw = process.env.KLAVIYO_API_KEY
  const hasKey = Boolean(typeof raw === "string" && raw.trim().length > 0)
  return NextResponse.json({
    klaviyo_key_configured: hasKey,
    node_env: process.env.NODE_ENV ?? "",
    cwd,
    env_local_file_exists: existsSync(envLocal),
    klaviyo_key_typeof: typeof raw,
  })
}
