import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { CareerApplicationStatusForm } from "@/components/features/admin/career-application-status-form"
import { getAdminCareerApplicationService } from "@/lib/services/careerApplications"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Career application — Admin — Reswell",
  description: "Review a careers application and resume.",
  path: "/admin/careers",
})

export default async function AdminCareerApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getAdminCareerApplicationService(id)
  if ("error" in result) {
    if (result.error === "Not found") notFound()
    return <p className="text-sm text-destructive">{result.error}</p>
  }

  const application = result.data

  return (
    <div className="space-y-6">
      <Link href="/admin/careers" className="text-sm underline">
        All applications
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{application.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {application.roleTitle}
          {" · "}
          {format(new Date(application.createdAt), "MMM d, yyyy")}
        </p>
      </div>

      <CareerApplicationStatusForm applicationId={application.id} status={application.status} />

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
          <dd className="mt-1">
            <a href={`mailto:${application.email}`} className="underline">
              {application.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</dt>
          <dd className="mt-1">{application.phone ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resume</dt>
          <dd className="mt-1">
            {application.resumeSignedUrl && application.resumeFileName ? (
              <a
                href={application.resumeSignedUrl}
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                {application.resumeFileName}
              </a>
            ) : (
              "None attached"
            )}
          </dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Surfing and buying experience</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {application.surfingNote}
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Favorite board</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {application.favoriteBoard}
        </p>
      </section>
    </div>
  )
}
