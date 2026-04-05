/**
 * Ensures `.env*` files are merged into `process.env` for API routes / server code.
 * Import this module once before reading `KLAVIYO_API_KEY`.
 */
import { loadEnvConfig } from "@next/env"

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production")
