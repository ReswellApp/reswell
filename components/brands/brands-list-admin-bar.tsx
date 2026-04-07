"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  BrandEditorDialog,
  type BrandCreatePrefillFromRequest,
} from "@/components/brands/brand-editor-dialog"
import { getAdminSession } from "@/app/actions/account"
import { slugifyBrandName } from "@/lib/brands/slug"

export function BrandsListAdminBar({ brandRequestImportId }: { brandRequestImportId?: string }) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [createPrefill, setCreatePrefill] = React.useState<BrandCreatePrefillFromRequest | null>(null)
  const handledImportIds = React.useRef(new Set<string>())

  React.useEffect(() => {
    let cancelled = false
    getAdminSession()
      .then((d: { isAdmin?: boolean }) => {
        if (!cancelled) {
          setIsAdmin(d.isAdmin === true)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!brandRequestImportId) {
      handledImportIds.current.clear()
    }
  }, [brandRequestImportId])

  React.useEffect(() => {
    if (!isAdmin || !brandRequestImportId) return
    if (handledImportIds.current.has(brandRequestImportId)) return
    handledImportIds.current.add(brandRequestImportId)

    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/admin/brand-requests/${encodeURIComponent(brandRequestImportId)}`, {
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as { request?: Record<string, unknown>; error?: string }
      if (cancelled) return

      if (!res.ok) {
        handledImportIds.current.delete(brandRequestImportId)
        toast.error(data.error || "Could not load brand request")
        router.replace("/brands", { scroll: false })
        return
      }

      const r = data.request
      if (!r || typeof r.id !== "string") {
        handledImportIds.current.delete(brandRequestImportId)
        toast.error("Request not found")
        router.replace("/brands", { scroll: false })
        return
      }

      if (r.status !== "pending") {
        handledImportIds.current.delete(brandRequestImportId)
        toast.message("This request was already processed")
        router.replace("/brands", { scroll: false })
        return
      }

      const about = Array.isArray(r.about_paragraphs)
        ? r.about_paragraphs.filter((x): x is string => typeof x === "string")
        : []
      const name = typeof r.requested_name === "string" ? r.requested_name.trim() : ""
      if (!name) {
        handledImportIds.current.delete(brandRequestImportId)
        toast.error("Request has no brand name")
        router.replace("/brands", { scroll: false })
        return
      }

      setCreatePrefill({
        brand_request_id: r.id,
        slug: slugifyBrandName(name),
        name,
        short_description: typeof r.short_description === "string" ? r.short_description : "",
        website_url: typeof r.website_url === "string" ? r.website_url : null,
        logo_url: typeof r.logo_url === "string" ? r.logo_url : null,
        founder_name: typeof r.founder_name === "string" ? r.founder_name : null,
        lead_shaper_name: typeof r.lead_shaper_name === "string" ? r.lead_shaper_name : null,
        location_label: typeof r.location_label === "string" ? r.location_label : null,
        about_paragraphs: about,
        model_count: 0,
      })
      setOpen(true)
      router.replace("/brands", { scroll: false })
    })()

    return () => {
      cancelled = true
    }
  }, [isAdmin, brandRequestImportId, router])

  if (!loaded || !isAdmin) return null

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="default"
        className="h-10 w-10 shrink-0 rounded-full shadow-soft"
        onClick={() => {
          setCreatePrefill(null)
          setOpen(true)
        }}
        aria-label="Add brand"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <BrandEditorDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setCreatePrefill(null)
        }}
        mode="create"
        brand={null}
        createPrefill={createPrefill}
      />
    </>
  )
}
