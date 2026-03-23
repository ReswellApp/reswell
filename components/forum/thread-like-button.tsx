"use client"

import { useRef, useState } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Props = {
  threadId: string
  initialCount: number
  initialLiked: boolean
  isLoggedIn: boolean
}

export function ThreadLikeButton({ threadId, initialCount, initialLiked, isLoggedIn }: Props) {
  const [count, setCount] = useState(initialCount)
  const [liked, setLiked] = useState(initialLiked)
  const busy = useRef(false)

  async function toggle() {
    if (!isLoggedIn || busy.current) return
    busy.current = true
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      busy.current = false
      return
    }

    const wasLiked = liked
    if (wasLiked) {
      setLiked(false)
      setCount((c) => Math.max(0, c - 1))
      const { error } = await supabase
        .from("forum_thread_likes")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", user.id)
      if (error) {
        setLiked(true)
        setCount((c) => c + 1)
        toast.error("Couldn’t update your like — try again.")
      }
    } else {
      setLiked(true)
      setCount((c) => c + 1)
      const { error } = await supabase.from("forum_thread_likes").insert({
        thread_id: threadId,
        user_id: user.id,
      })
      if (error) {
        setLiked(false)
        setCount((c) => Math.max(0, c - 1))
        toast.error("Couldn’t update your like — try again.")
      }
    }
    busy.current = false
  }

  const loginHref = `/auth/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/wax-room")}`

  if (!isLoggedIn) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 rounded-full px-4 shadow-sm transition-transform active:scale-95" asChild>
              <Link href={loginHref}>
                <Heart className="h-4 w-4" />
                <span className="tabular-nums">{count > 0 ? count : "Stoke"}</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Log in to show love for this post</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            className={cn(
              "gap-2 rounded-full px-4 shadow-sm transition-all duration-200 active:scale-95",
              liked
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                : "border-border bg-background hover:border-primary/30 hover:bg-muted/50",
            )}
            variant="outline"
            onClick={() => void toggle()}
            aria-pressed={liked}
          >
            <Heart className={cn("h-4 w-4 transition-transform duration-200", liked && "scale-110 fill-current")} />
            <span className="min-w-[1ch] tabular-nums font-medium">{count}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{liked ? "Remove your stoke" : "Tap if you’re stoked on this post"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
