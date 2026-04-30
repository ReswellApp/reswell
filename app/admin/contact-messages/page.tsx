import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { ContactMessagesAdminClient } from "@/components/features/admin/contact-messages-admin-client"

export const metadata = privatePageMetadata({
  title: "Support inbox — Admin — Reswell",
  description: "Customer support tickets from the website and from in-app Messages.",
  path: "/admin/contact-messages",
})

export default function AdminContactMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <ContactMessagesAdminClient />
    </Suspense>
  )
}
