"use client"

import { useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { uploadSupportCaseEvidenceFile } from "@/lib/support-case-media-upload-client"
import type { SupportCaseAttachmentInput } from "@/lib/validations/support-case-attachment"
import { SUPPORT_CASE_MAX_EVIDENCE_PHOTOS } from "@/lib/validations/support-case-attachment"
import type { SupportEvidenceKind } from "@/lib/types/protectionClaimDesk"
import { SUPPORT_EVIDENCE_KIND_LABEL } from "@/lib/types/protectionClaimDesk"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ClaimEvidenceUploaderProps {
  userId: string
  value: SupportCaseAttachmentInput[]
  onChange: (next: SupportCaseAttachmentInput[]) => void
  className?: string
}

export function ClaimEvidenceUploader({
  userId,
  value,
  onChange,
  className,
}: ClaimEvidenceUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [kind, setKind] = useState<SupportEvidenceKind>("damage")

  async function onPick(files: FileList | null) {
    if (!files?.length) return
    const remaining = SUPPORT_CASE_MAX_EVIDENCE_PHOTOS - value.length
    if (remaining <= 0) {
      toast.error(`You can add up to ${SUPPORT_CASE_MAX_EVIDENCE_PHOTOS} photos.`)
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error("Sign in again to upload photos.")
        return
      }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !anonKey) {
        toast.error("Upload is not configured.")
        return
      }

      const next = [...value]
      for (const file of Array.from(files).slice(0, remaining)) {
        const uploaded = await uploadSupportCaseEvidenceFile({
          file,
          uploaderId: userId,
          supabaseUrl,
          accessToken: session.access_token,
          anonKey,
          evidenceKind: kind,
        })
        next.push(uploaded.attachment)
      }
      onChange(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Photo type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as SupportEvidenceKind)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SUPPORT_EVIDENCE_KIND_LABEL) as SupportEvidenceKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SUPPORT_EVIDENCE_KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={uploading} asChild>
          <label className="cursor-pointer">
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void onPick(e.target.files)
                e.target.value = ""
              }}
            />
          </label>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        For damage claims, include the item, packing/box, and carrier label when possible.
      </p>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((a) => (
            <li
              key={a.path}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs"
            >
              <span className="max-w-[140px] truncate">{a.file_name}</span>
              <span className="text-muted-foreground">
                · {SUPPORT_EVIDENCE_KIND_LABEL[a.evidence_kind ?? "damage"]}
              </span>
              <button
                type="button"
                className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${a.file_name}`}
                onClick={() => onChange(value.filter((x) => x.path !== a.path))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
