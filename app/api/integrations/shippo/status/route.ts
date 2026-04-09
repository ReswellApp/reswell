import { isShippoConfigured } from "@/lib/shippo/config"
import { shippoRequest } from "@/lib/shippo/client"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { NextResponse } from "next/server"

/**
 * Debug: key presence + whether Shippo accepts the key (GET /carrier_accounts).
 * Does not return secret material.
 */
export async function GET() {
  const cwd = process.cwd()
  const envLocal = join(cwd, ".env.local")
  const configured = isShippoConfigured()

  if (!configured) {
    return NextResponse.json({
      shippo_key_configured: false,
      cwd,
      env_local_file_exists: existsSync(envLocal),
    })
  }

  const res = await shippoRequest("/carrier_accounts?results=1", { method: "GET" })
  return NextResponse.json({
    shippo_key_configured: true,
    api_ok: res.ok,
    api_status: res.status,
    cwd,
    env_local_file_exists: existsSync(envLocal),
  })
}
