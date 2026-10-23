"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Tag } from "lucide-react"
import { toast } from "sonner"
import { updateShippingLabelNameAction } from "@/app/actions/shippingLabelName"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { SHIPPING_LABEL_NAME_MAX } from "@/lib/validations/shippingLabelName"
import {
  profileCardClass,
  profileInputClass,
  profileLabelClass,
  profilePillButtonClass,
  profileSectionHintClass,
  profileSectionTitleClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"

export type ShippingLabelNameCopy = {
  title: string
  description: string
  privateBadge: string
  field: string
  hint: string
  save: string
  update: string
  saving: string
  saved: string
}

interface ShippingLabelNameSectionProps {
  copy: ShippingLabelNameCopy
  initialName: string | null
  /** What prints today when this field is empty (shop or display name). */
  fallbackName: string | null
}

export function ShippingLabelNameSection({
  copy,
  initialName,
  fallbackName,
}: ShippingLabelNameSectionProps) {
  const [name, setName] = useState(initialName ?? "")
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [hasStoredOnce, setHasStoredOnce] = useState(() => Boolean(initialName?.trim()))

  useEffect(() => {
    setName(initialName ?? "")
    setHasStoredOnce(Boolean(initialName?.trim()))
  }, [initialName])

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateShippingLabelNameAction({
        shipping_label_name: name.trim() ? name : null,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setName(result.shipping_label_name ?? "")
      setHasStoredOnce(Boolean(result.shipping_label_name))
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 2000)
    } catch {
      toast.error("Could not save the name on your shipping label.")
    } finally {
      setSaving(false)
    }
  }

  const buttonLabel = hasStoredOnce ? copy.update : copy.save
  const placeholder = fallbackName?.trim() || "ELUDE"

  return (
    <section className={`${profileCardClass} space-y-5 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className={cn(profileSectionTitleClass, "flex items-center gap-2")}>
            <Tag className="h-4 w-4 text-muted-foreground" aria-hidden />
            {copy.title}
          </h2>
          <p className={profileSectionHintClass}>{copy.description}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs font-medium">
          {copy.privateBadge}
        </Badge>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shipping-label-name" className={profileLabelClass}>
          {copy.field}
        </Label>
        <Input
          id="shipping-label-name"
          autoComplete="organization"
          className={profileInputClass}
          value={name}
          maxLength={SHIPPING_LABEL_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">{copy.hint}</p>
      </div>

      <Button
        className={profilePillButtonClass(saving || savedFlash)}
        onClick={() => void handleSave()}
        disabled={saving || savedFlash}
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {copy.saving}
          </>
        ) : savedFlash ? (
          <>
            <Check className="mr-2 h-4 w-4" aria-hidden />
            {copy.saved}
          </>
        ) : (
          buttonLabel
        )}
      </Button>
    </section>
  )
}
