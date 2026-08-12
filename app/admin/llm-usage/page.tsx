import { privatePageMetadata } from "@/lib/site-metadata"
import { LlmUsageAdminClient } from "@/components/features/admin/llm-usage-admin-client"

export const metadata = privatePageMetadata({
  title: "LLM usage — Reswell admin",
  description:
    "Models in use across Reswell, Vercel AI Gateway spend, and feature-level cost attribution.",
  path: "/admin/llm-usage",
})

export default function AdminLlmUsagePage() {
  return (
    <>
      <h1 className="sr-only">LLM usage</h1>
      <LlmUsageAdminClient />
    </>
  )
}
