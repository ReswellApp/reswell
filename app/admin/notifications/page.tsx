import { privatePageMetadata } from "@/lib/site-metadata"
import { NotificationsCenterClient } from "@/components/features/admin/notifications-center-client"

export const metadata = privatePageMetadata({
  title: "Notifications center — Reswell admin",
  description: "Klaviyo metric accepts, flow delivery, and in-app notification analytics.",
  path: "/admin/notifications",
})

export default function AdminNotificationsPage() {
  return (
    <>
      <h1 className="sr-only">Notifications center</h1>
      <NotificationsCenterClient />
    </>
  )
}
