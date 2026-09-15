import { privatePageMetadata } from "@/lib/site-metadata"
import { listSupportMacrosAdminService } from "@/lib/services/supportMacros"
import { SupportMacrosAdminClient } from "@/components/features/admin/support-macros/support-macros-admin-client"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Reply macros — Admin — Reswell",
  description: "Add and edit canned support replies without a migration.",
  path: "/admin/support-macros",
})

export default async function AdminSupportMacrosPage() {
  const result = await listSupportMacrosAdminService()
  const macros = "success" in result ? result.data : []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reply macros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Canned replies for the support inbox. Use{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[12px]">{"{{name}}"}</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[12px]">{"{{order_ref}}"}</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[12px]">{"{{tracking}}"}</code>, and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[12px]">{"{{order_status}}"}</code> —
          they fill in when a teammate inserts the macro.
        </p>
      </div>
      {"error" in result ? <p className="text-sm text-destructive">{result.error}</p> : null}
      <SupportMacrosAdminClient initialMacros={macros} />
    </div>
  )
}
