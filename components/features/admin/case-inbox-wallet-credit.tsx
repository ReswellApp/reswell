"use client"

import { useState } from "react"
import { Wallet } from "lucide-react"
import { AdminWalletCreditDialog } from "@/components/features/admin/admin-wallet-credit-dialog"
import { Button } from "@/components/ui/button"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"

interface CaseInboxWalletCreditProps {
  userId: string
  displayName?: string | null
  email?: string | null
  supportCaseId: string
  variant?: "panel" | "icon"
  onCredited?: () => void
}

export function CaseInboxWalletCredit({
  userId,
  displayName,
  email,
  supportCaseId,
  variant = "panel",
  onCredited,
}: CaseInboxWalletCreditProps) {
  const [open, setOpen] = useState(false)
  const ticketRef = formatSupportCaseReference(supportCaseId)

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setOpen(true)}
          aria-label="Credit wallet"
        >
          <Wallet className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full text-[11px]"
          onClick={() => setOpen(true)}
        >
          <Wallet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Credit wallet
        </Button>
      )}
      <AdminWalletCreditDialog
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        displayName={displayName}
        email={email}
        supportCaseId={supportCaseId}
        defaultNote={`Support ticket ${ticketRef}`}
        notePlaceholder="Goodwill credit, reimbursement, packing materials…"
        onCredited={() => onCredited?.()}
      />
    </>
  )
}
