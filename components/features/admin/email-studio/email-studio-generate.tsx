"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { generateEmailStudioAction } from "@/lib/actions/emailStudio"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const EMAIL_TYPES = [
  "Campaign announcement",
  "Product spotlight",
  "Newsletter or editorial",
  "Lifecycle or retention",
  "Transactional",
  "Educational",
] as const

const EMAIL_TONES = [
  "Calm and direct",
  "Warm and personal",
  "Editorial",
  "Helpful and reassuring",
  "Urgent but restrained",
] as const

interface EmailBrief {
  objective: string
  audience: string
  emailType: string
  productsOrCategory: string
  offer: string
  tone: string
  primaryCta: string
}

const INITIAL_EMAIL_BRIEF: EmailBrief = {
  objective: "",
  audience: "",
  emailType: EMAIL_TYPES[0],
  productsOrCategory: "",
  offer: "",
  tone: EMAIL_TONES[0],
  primaryCta: "",
}

export function EmailStudioGenerate({
  target,
  enabled,
}: {
  target: "email" | "flow"
  enabled: boolean
}) {
  const router = useRouter()
  const [brief, setBrief] = useState("")
  const [emailBrief, setEmailBrief] = useState<EmailBrief>(INITIAL_EMAIL_BRIEF)
  const [pending, setPending] = useState(false)

  async function generate(): Promise<void> {
    const text = brief.trim()
    if (target === "flow" && text.length < 8) return toast.error("Describe it in a sentence")
    if (
      target === "email"
      && (!emailBrief.objective.trim()
        || !emailBrief.audience.trim()
        || !emailBrief.productsOrCategory.trim()
        || !emailBrief.primaryCta.trim())
    ) return toast.error("Complete the required email brief")

    setPending(true)
    const result = target === "flow"
      ? await generateEmailStudioAction({ brief: text, target })
      : await generateEmailStudioAction({ target, ...emailBrief })
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
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault()
          void generate()
        }}>
          {target === "flow" ? (
            <Textarea
              value={brief}
              aria-label="Flow brief"
              placeholder="Welcome flow: an email now, wait two days, then a listing spotlight. Subscribers only."
              maxLength={2000}
              className="min-h-24 bg-background"
              onChange={(event) => setBrief(event.target.value)}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <BriefField label="Objective" required>
                <Input
                  value={emailBrief.objective}
                  placeholder="Drive qualified buyers to new mid-length listings"
                  maxLength={500}
                  onChange={(event) => setEmailBrief((current) => ({ ...current, objective: event.target.value }))}
                />
              </BriefField>
              <BriefField label="Audience" required>
                <Input
                  value={emailBrief.audience}
                  placeholder="Subscribers interested in mid-length boards"
                  maxLength={500}
                  onChange={(event) => setEmailBrief((current) => ({ ...current, audience: event.target.value }))}
                />
              </BriefField>
              <BriefField label="Email type" required>
                <select
                  value={emailBrief.emailType}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => setEmailBrief((current) => ({ ...current, emailType: event.target.value }))}
                >
                  {EMAIL_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </BriefField>
              <BriefField label="Products or category" required>
                <Input
                  value={emailBrief.productsOrCategory}
                  placeholder="Mid-length boards, or paste exact listing details"
                  maxLength={1000}
                  onChange={(event) => setEmailBrief((current) => ({ ...current, productsOrCategory: event.target.value }))}
                />
              </BriefField>
              <BriefField label="Offer">
                <Input
                  value={emailBrief.offer}
                  placeholder="Optional — leave blank when there is no offer"
                  maxLength={500}
                  onChange={(event) => setEmailBrief((current) => ({ ...current, offer: event.target.value }))}
                />
              </BriefField>
              <BriefField label="Tone" required>
                <select
                  value={emailBrief.tone}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => setEmailBrief((current) => ({ ...current, tone: event.target.value }))}
                >
                  {EMAIL_TONES.map((tone) => <option key={tone}>{tone}</option>)}
                </select>
              </BriefField>
              <BriefField label="Primary call to action" required className="sm:col-span-2">
                <Input
                  value={emailBrief.primaryCta}
                  placeholder="Browse mid-lengths — https://www.reswell.app/boards"
                  maxLength={500}
                  onChange={(event) => setEmailBrief((current) => ({ ...current, primaryCta: event.target.value }))}
                />
              </BriefField>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
            {pending ? "Designing…" : target === "flow" ? "Generate flow" : "Generate email"}
            </Button>
            {target === "email" ? (
              <p className="text-xs text-muted-foreground">Reswell voice, layout, footer, and brand styling are applied automatically.</p>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Generation needs AI Gateway authentication. Set AI_GATEWAY_API_KEY, or pull Vercel OIDC credentials, then restart the dev server.
        </p>
      )}
    </section>
  )
}

function BriefField({
  label,
  required = false,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Label className={className}>
      <span className="mb-1.5 block text-xs">
        {label}{required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </Label>
  )
}
