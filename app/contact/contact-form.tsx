"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { CheckCircle2, Send } from "lucide-react"
import { submitContactMessage } from "@/app/actions/account"

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await submitContactMessage({ name, email, message })
      if ("error" in data) {
        toast.error(data.error ?? "Failed to send message")
        return
      }
      setSubmitted(true)
    } catch {
      toast.error("Failed to send message")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <Card className="rounded-2xl border-border/80 bg-gradient-to-br from-muted/50 to-card shadow-lg shadow-black/[0.06] dark:shadow-black/25">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-foreground">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">Message received</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Thanks for reaching out. We’ve logged your note and will follow up within 1–2 business days when a
                reply is needed. For quick answers, the{" "}
                <Link href="/help" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
                  Help Center
                </Link>{" "}
                is always open.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      id="contact-form"
      className="rounded-2xl border-border/80 shadow-lg shadow-black/[0.06] dark:shadow-black/25"
    >
      <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
        <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">Send a secure message</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Share as much context as you can (order or listing details help). Your message is sent over a secure
          connection.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-11 rounded-xl border-border/80 bg-background"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 rounded-xl border-border/80 bg-background"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message" className="text-foreground">
              Message
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What can we help with? Include listing links or order details if relevant."
              rows={6}
              className="min-h-[140px] resize-y rounded-xl border-border/80 bg-background"
              required
            />
          </div>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" size="lg" disabled={loading} className="h-11 min-w-[160px] rounded-xl gap-2">
              {loading ? (
                "Sending…"
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden />
                  Send message
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground sm:max-w-[220px] sm:text-right">
              Urgent safety or fraud? Start your message with{" "}
              <span className="font-medium text-foreground">Urgent</span>.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
