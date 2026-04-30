import { privatePageMetadata } from "@/lib/site-metadata"
import { ContactMessagesAdminClient } from "@/components/features/admin/contact-messages-admin-client"

export const metadata = privatePageMetadata({
  title: "Support inbox — Admin — Reswell",
  description: "Customer support tickets from the website and from in-app Messages.",
  path: "/admin/contact-messages",
})

export default function AdminContactMessagesPage() {
  return <ContactMessagesAdminClient />
}
