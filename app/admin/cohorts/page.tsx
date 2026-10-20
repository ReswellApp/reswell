import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminCohortsClient } from "@/components/features/admin/admin-cohorts-client"

export const metadata = privatePageMetadata({
  title: "Cohorts — Reswell admin",
  description:
    "Signup-month user cohorts: monthly return retention and how often users come back over six months.",
  path: "/admin/cohorts",
})

export default function AdminCohortsPage() {
  return (
    <>
      <h1 className="sr-only">Cohorts</h1>
      <AdminCohortsClient />
    </>
  )
}
