import Link from "next/link"
import { format } from "date-fns"
import { listAdminCareerApplicationsService } from "@/lib/services/careerApplications"
import { privatePageMetadata } from "@/lib/site-metadata"
import type { CareerApplicationStatus } from "@/lib/types/career-application"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Career applications — Admin — Reswell",
  description: "Applications and resumes from /careers.",
  path: "/admin/careers",
})

function statusLabel(status: CareerApplicationStatus): string {
  if (status === "reviewed") return "Reviewed"
  if (status === "archived") return "Archived"
  return "New"
}

export default async function AdminCareersPage() {
  const result = await listAdminCareerApplicationsService()
  const rows = "success" in result ? result.data : []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Career applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submissions from the careers apply form, including optional resumes.
        </p>
      </div>
      {"error" in result ? <p className="text-sm text-destructive">{result.error}</p> : null}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Applicant</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Resume</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/admin/careers/${row.id}`} className="font-medium underline">
                    {row.name}
                  </Link>
                  <p className="text-muted-foreground">{row.email}</p>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.roleTitle}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.resumeFileName ? "Yes" : "—"}
                </td>
                <td className="px-3 py-2">{statusLabel(row.status)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {format(new Date(row.createdAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-sm text-muted-foreground">No applications yet.</p>
        ) : null}
      </div>
    </div>
  )
}
