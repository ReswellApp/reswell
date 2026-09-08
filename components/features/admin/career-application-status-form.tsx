"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateCareerApplicationStatusAction } from "@/lib/actions/careerApplicationActions"
import { Button } from "@/components/ui/button"
import type { CareerApplicationStatus } from "@/lib/types/career-application"
import { toast } from "sonner"

const STATUS_OPTIONS: { value: CareerApplicationStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "archived", label: "Archived" },
]

type CareerApplicationStatusFormProps = {
  applicationId: string
  status: CareerApplicationStatus
}

export function CareerApplicationStatusForm({
  applicationId,
  status,
}: CareerApplicationStatusFormProps) {
  const router = useRouter()
  const [pending, setPending] = useState<CareerApplicationStatus | null>(null)

  async function setStatus(next: CareerApplicationStatus) {
    if (next === status) return
    setPending(next)
    const result = await updateCareerApplicationStatusAction({
      id: applicationId,
      status: next,
    })
    setPending(null)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === status ? "default" : "outline"}
          disabled={pending != null}
          onClick={() => void setStatus(option.value)}
        >
          {pending === option.value ? "Saving…" : option.label}
        </Button>
      ))}
    </div>
  )
}
