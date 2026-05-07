import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { FraudMessagesAdminClient } from "@/components/features/admin/fraud-messages-admin-client"

export const metadata = privatePageMetadata({
  title: "Intercepted chats — Admin — Reswell",
  description: "Marketplace messages blocked for policy (phone-like content).",
  path: "/admin/fraud-messages",
})

export default function AdminFraudMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <FraudMessagesAdminClient />
    </Suspense>
  )
}
