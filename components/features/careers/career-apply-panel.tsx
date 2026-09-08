"use client"

import { useState } from "react"
import { CareerApplicationReceived } from "@/components/features/careers/career-application-received"
import { CareerApplyForm } from "@/components/features/careers/career-apply-form"
import { cn } from "@/lib/utils"

export function CareerApplyPanel({
  roleSlug,
  roleTitle,
  intro,
  surfingLabel,
  favoriteBoardLabel,
  note,
}: {
  roleSlug?: string | null
  roleTitle: string
  intro: string
  surfingLabel: string
  favoriteBoardLabel: string
  note?: string
}) {
  const [applicantName, setApplicantName] = useState<string | null>(null)

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card shadow-sm",
        applicantName ? "px-5 py-10 sm:px-8 sm:py-12" : "p-5 sm:p-7",
      )}
    >
      {applicantName ? (
        <CareerApplicationReceived applicantName={applicantName} roleTitle={roleTitle} />
      ) : (
        <>
          <p className="font-headline text-base font-semibold text-foreground">Application</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{intro}</p>
          <div className="mt-6">
            <CareerApplyForm
              roleSlug={roleSlug}
              surfingLabel={surfingLabel}
              favoriteBoardLabel={favoriteBoardLabel}
              note={note}
              variant="page"
              onSuccess={setApplicantName}
            />
          </div>
        </>
      )}
    </div>
  )
}
