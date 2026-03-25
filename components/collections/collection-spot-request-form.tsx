"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type Props = {
  isLoggedIn: boolean
  loginRedirectPath: string
}

export function CollectionSpotRequestForm({ isLoggedIn, loginRedirectPath }: Props) {
  const [message, setMessage] = useState("")
  const [socialLink, setSocialLink] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) {
      toast.error("Describe your quiver")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/collection-spot-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          social_link: socialLink.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Something went wrong")
        return
      }
      setDone(true)
      setMessage("")
      setSocialLink("")
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <Card className="border-border/80 bg-muted/10">
        <CardHeader>
          <CardTitle className="text-lg">Request a spot</CardTitle>
          <CardDescription>
            Sign in to tell us about your boards. We review every application and curate the page by hand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/auth/login?redirect=${encodeURIComponent(loginRedirectPath)}`}>Sign in to request</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="font-medium text-foreground">Request received</p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Thanks for sharing your story. If it’s a fit, we’ll follow up and help get your quiver photographed and
            live on Collections.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-lg">Request a spot</CardTitle>
        <CardDescription>
          Spots are limited. Share what makes your quiver special—shapes you love, locals you ride, or boards you’ve
          hunted down. We’ll reach out if we can feature you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collection-message">Your collection</Label>
            <Textarea
              id="collection-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Boards in the rack, what you surf most, photos you have (or plan to shoot)…"
              rows={5}
              className="resize-y min-h-[120px]"
              maxLength={5000}
              required
            />
            <p className="text-xs text-muted-foreground">{message.length} / 5000</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-social">Instagram or link (optional)</Label>
            <Input
              id="collection-social"
              value={socialLink}
              onChange={(e) => setSocialLink(e.target.value)}
              placeholder="@yourhandle or a link to photos"
              maxLength={500}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Sending…" : "Submit request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
