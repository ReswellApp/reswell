import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { shipEngineRequest } from "@/lib/shipengine/client"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { NextResponse } from "next/server"

/**
 * Debug: key presence + whether ShipEngine accepts the key (GET /v1/carriers).
 * Does not return secret material.
 */
export async function GET() {
  const cwd = process.cwd()
  const envLocal = join(cwd, ".env.local")
  const configured = isShipEngineConfigured()

  if (!configured) {
    return NextResponse.json({
      shipengine_key_configured: false,
      cwd,
      env_local_file_exists: existsSync(envLocal),
    })
  }

  const res = await shipEngineRequest("/carriers", { method: "GET" })
  return NextResponse.json({
    shipengine_key_configured: true,
    api_ok: res.ok,
    api_status: res.status,
    cwd,
    env_local_file_exists: existsSync(envLocal),
  })
}
