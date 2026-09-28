"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { generateEmailStudioAction } from "@/lib/actions/emailStudio"
import { Button } from "@/components/ui/button"

export function EmailStudioGenerate({
  target,
  enabled,
}: {
  target: "email" | "flow"
  enabled: boolean
}) {
  const router = useRouter()
  const [brief, setBrief] = useState("")
  const [pending, setPending] = useState(false)
  const placeholder = target === "flow"
    ? "Welcome flow: an email now, wait two days, then a listing spotlight. Subscribers only."
    : "A calm shipped email with the order number, the board, and one tracking button."

  async function generate(): Promise<void> {
    const text = brief.trim()
    if (text.length < 8) {
      toast.error("Describe it in a sentence")
      return
    }
    setPending(true)
    const result = await generateEmailStudioAction({ brief: text, target })
    setPending(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    toast.success(target === "flow" ? "Flow designed" : "Email designed")
    router.push(target === "flow" ? `/admin/email-studio/flows/${result.id}` : `/admin/email-studio/${result.id}`)
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-[#F9F9F2] p-4">
      <div>
        <h2 className="text-sm font-medium">Generate with the assistant</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          {target === "flow"
            ? "Describe the sequence. The assistant builds the trigger, the waits, and a designed email for each send. Nothing goes live."
            : "Describe the email. The assistant designs the hero, the sections, and the closer, then opens it on the artboard."}
        </p>
      </div>
      {enabled ? (
        <>
          <textarea
            value={brief}
            aria-label={target === "flow" ? "Flow brief" : "Email brief"}
            placeholder={placeholder}
            maxLength={2000}
            className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
            onChange={(event) => setBrief(event.target.value)}
          />
          <Button disabled={pending} onClick={() => void generate()}>
            {pending ? "Designing…" : target === "flow" ? "Generate flow" : "Generate email"}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Generation needs AI Gateway authentication. Set AI_GATEWAY_API_KEY, or pull Vercel OIDC credentials, then restart the dev server.
        </p>
      )}
    </section>
  )
}
