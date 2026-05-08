"use client"

import { useRef, useState } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Props = {
  commentId: string
  initialCount: number
  initialLiked: boolean
  isLoggedIn: boolean
  compact?: boolean
}

export function CommentLikeButton({
  commentId,
  initialCount,
  initialLiked,
  isLoggedIn,
  compact,
}: Props) {
  const [count, setCount] = useState(initialCount)
  const [liked, setLiked] = useState(initialLiked)
  const busy = useRef(false)
  const openSignIn = useSignInGate()

  const pillClass = cn(
    "gap-1.5 rounded-full border bg-background/90 px-3 shadow-sm backdrop-blur-sm transition-all duration-200",
    "hover:border-primary/25 hover:bg-muted/60 active:scale-95",
    compact ? "h-8 text-xs" : "h-9",
    "text-muted-foreground hover:text-foreground",
  )

  async function toggle() {
    if (!isLoggedIn || busy.current) return
    busy.current = true
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      busy.current = false
      openSignIn(null)
      return
    }

    if (liked) {
      setLiked(false)
      setCount((c) => Math.max(0, c - 1))
      const { error } = await supabase
        .from("forum_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
      if (error) {
        setLiked(true)
        setCount((c) => c + 1)
        toast.error("Couldn’t update like — try again.")
      }
    } else {
      setLiked(true)
      setCount((c) => c + 1)
      const { error } = await supabase.from("forum_comment_likes").insert({
        comment_id: commentId,
        user_id: user.id,
      })
      if (error) {
        setLiked(false)
        setCount((c) => Math.max(0, c - 1))
        toast.error("Couldn’t update like — try again.")
      }
    }
    busy.current = false
  }

  if (!isLoggedIn) {
    return (
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={pillClass}
              onClick={() => openSignIn(null)}
            >
              <Heart className={cn("h-3.5 w-3.5", compact && "h-3 w-3")} />
              <span className="tabular-nums">{count > 0 ? count : "Like"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Log in to like replies</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              pillClass,
              liked && "border-primary/35 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
            onClick={() => void toggle()}
            aria-pressed={liked}
          >
            <Heart
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                compact && "h-3 w-3",
                liked && "scale-110 fill-current",
              )}
            />
            <span className="min-w-[1ch] tabular-nums font-medium">{count}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{liked ? "Unlike" : "Stoke this reply"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
