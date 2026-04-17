import { privatePageMetadata } from "@/lib/site-metadata"
import { ContactMessagesAdminClient } from "@/components/features/admin/contact-messages-admin-client"

export const metadata = privatePageMetadata({
  title: "Contact messages — Admin — Reswell",
  description: "Review inbound contact and support messages submitted through Reswell.",
  path: "/admin/contact-messages",
})

export default function AdminContactMessagesPage() {
  return <ContactMessagesAdminClient />
}
