"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Reply, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CommentLikeButton } from "@/components/forum/comment-like-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { clearImpersonation, getImpersonation } from "@/lib/impersonation"

export type ThreadCommentRow = {
  id: string
  body: string
  created_at: string
  user_id: string
  parent_id: string | null
  profiles: { display_name: string | null; avatar_url: string | null } | null
  forum_comment_likes?: { count: number }[] | null
}

type Props = {
  threadId: string
  initialComments: ThreadCommentRow[]
  currentUserId: string | null
  isLoggedIn: boolean
  likedCommentIds: string[]
}

const MAX_LEN = 8000

function likeCount(row: ThreadCommentRow) {
  const raw = row.forum_comment_likes
  if (Array.isArray(raw) && raw[0] && typeof raw[0].count === "number") return raw[0].count
  return 0
}

function displayName(row: ThreadCommentRow) {
  return row.profiles?.display_name?.trim() || "Member"
}

/** After DOM updates, scroll so the new comment is in view (clears temp scroll-margin after animation). */
function scrollPostedCommentIntoView(
  commentId: string,
  composerBarEl: HTMLElement | null,
) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(`comment-${commentId}`)
      if (!el) return
      const barH = composerBarEl ? Math.ceil(composerBarEl.getBoundingClientRect().height) : 0
      const marginBottom = Math.max(barH + 16, 120)
      el.style.scrollMarginBottom = `${marginBottom}px`
      el.style.scrollMarginTop = "72px"
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
      window.setTimeout(() => {
        el.style.scrollMarginBottom = ""
        el.style.scrollMarginTop = ""
      }, 1800)
    })
  })
}

export function ThreadCommentsPanel({
  threadId,
  initialComments,
  currentUserId,
  isLoggedIn,
  likedCommentIds: initialLikedIds,
}: Props) {
  const [impersonation, setImpersonation] = useState<ReturnType<typeof getImpersonation>>(null)
  useEffect(() => { setImpersonation(getImpersonation()) }, [])
  const [comments, setComments] = useState(initialComments)
  const [likedIds, setLikedIds] = useState(() => new Set(initialLikedIds))
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [composerBarHeight, setComposerBarHeight] = useState(104)
  /** While true, bar is fixed to the viewport; when the thread card ends on screen, pin to article bottom instead (no overlap with site footer). */
  const [composerFixedToViewport, setComposerFixedToViewport] = useState(true)
  /** Fixed mode: pin horizontal geometry to the thread `<article>` so the bar never spans the full viewport. */
  const [articleDockRect, setArticleDockRect] = useState<{ left: number; width: number } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const composerBarRef = useRef<HTMLDivElement>(null)

  const topLevel = useMemo(() => {
    return comments
      .filter((c) => c.parent_id == null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [comments])

  const repliesByParent = useMemo(() => {
    const m = new Map<string, ThreadCommentRow[]>()
    for (const c of comments) {
      if (c.parent_id == null) continue
      const arr = m.get(c.parent_id) ?? []
      arr.push(c)
      m.set(c.parent_id, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
    return m
  }, [comments])

  const replyCount = comments.length - topLevel.length

  useLayoutEffect(() => {
    const el = composerBarRef.current
    if (!el) return
    const measure = () => setComposerBarHeight(Math.ceil(el.getBoundingClientRect().height))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isLoggedIn])

  useLayoutEffect(() => {
    const bar = composerBarRef.current
    const article = bar?.closest("article")
    if (!bar || !article) return

    function syncComposerLayout() {
      const ab = article.getBoundingClientRect()
      const h = window.innerHeight
      setArticleDockRect({ left: Math.round(ab.left), width: Math.round(ab.width) })
      setComposerFixedToViewport(ab.bottom > h - 0.5)
    }

    syncComposerLayout()
    window.addEventListener("scroll", syncComposerLayout, { passive: true })
    window.addEventListener("resize", syncComposerLayout)
    return () => {
      window.removeEventListener("scroll", syncComposerLayout)
      window.removeEventListener("resize", syncComposerLayout)
    }
  }, [isLoggedIn, comments.length])

  useEffect(() => {
    if (!replyingToId) return
    const t = window.setTimeout(() => replyTextareaRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [replyingToId])

  function openReplyTo(commentId: string) {
    setReplyingToId((prev) => (prev === commentId ? null : commentId))
    setReplyBody("")
  }

  async function submitTopLevel(e?: React.FormEvent) {
    e?.preventDefault()
    const text = body.trim()
    if (!text || (!isLoggedIn && !impersonation) || submitting) return
    setSubmitting(true)

    if (impersonation) {
      const res = await fetch("/api/admin/impersonate/create-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, body: text, parentId: null }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Stale impersonation in localStorage — clear it and fall through to post as the logged-in user.
        if (isLoggedIn && (res.status === 400 || res.status === 401 || res.status === 403)) {
          setImpersonation(null)
          clearImpersonation()
          // fall through to regular post below
        } else {
          toast.error(data.error || "Could not post comment as this user.")
          setSubmitting(false)
          return
        }
      } else {
        const sb = createClient()
        const { data: profile } = await sb
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", impersonation.userId)
          .single()
        const newId = data.comment.id
        setComments((prev) => [
          ...prev,
          {
            ...data.comment,
            parent_id: data.comment.parent_id ?? null,
            profiles: profile ?? { display_name: null, avatar_url: null },
            forum_comment_likes: [{ count: 0 }],
          },
        ])
        setBody("")
        setSubmitting(false)
        toast.success(`Comment posted as ${impersonation.displayName}`)
        scrollPostedCommentIntoView(newId, composerBarRef.current)
        return
      }
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    const { data: inserted, error } = await supabase
      .from("forum_comments")
      .insert({ thread_id: threadId, user_id: user.id, body: text, parent_id: null })
      .select("id, body, created_at, user_id, parent_id")
      .single()

    if (error || !inserted) {
      toast.error("Couldn’t post your comment — try again.")
      setSubmitting(false)
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single()

    const newId = inserted.id
    setComments((prev) => [
      ...prev,
      {
        ...inserted,
        parent_id: inserted.parent_id ?? null,
        profiles: profile ?? { display_name: null, avatar_url: null },
        forum_comment_likes: [{ count: 0 }],
      },
    ])
    setBody("")
    setSubmitting(false)
    toast.success("Comment posted")
    scrollPostedCommentIntoView(newId, composerBarRef.current)
  }

  async function submitReply(parentId: string) {
    const parent = comments.find((c) => c.id === parentId)
    if (!parent || parent.parent_id != null) {
      toast.error("You can only reply to a top-level comment.")
      return
    }
    const text = replyBody.trim()
    if (!text || (!isLoggedIn && !impersonation) || replySubmitting) return
    setReplySubmitting(true)

    if (impersonation) {
      const res = await fetch("/api/admin/impersonate/create-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, body: text, parentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Stale impersonation in localStorage — clear it and fall through to post as the logged-in user.
        if (isLoggedIn && (res.status === 400 || res.status === 401 || res.status === 403)) {
          setImpersonation(null)
          clearImpersonation()
          // fall through to regular post below
        } else {
          toast.error(data.error || "Could not post reply as this user.")
          setReplySubmitting(false)
          return
        }
      } else {
        const sb = createClient()
        const { data: profile } = await sb
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", impersonation.userId)
          .single()
        const newId = data.comment.id
        setComments((prev) => [
          ...prev,
          {
            ...data.comment,
            parent_id: data.comment.parent_id ?? parentId,
            profiles: profile ?? { display_name: null, avatar_url: null },
            forum_comment_likes: [{ count: 0 }],
          },
        ])
        setReplyBody("")
        setReplyingToId(null)
        setReplySubmitting(false)
        toast.success(`Reply posted as ${impersonation.displayName}`)
        scrollPostedCommentIntoView(newId, composerBarRef.current)
        return
      }
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setReplySubmitting(false)
      return
    }

    const { data: inserted, error } = await supabase
      .from("forum_comments")
      .insert({ thread_id: threadId, user_id: user.id, body: text, parent_id: parentId })
      .select("id, body, created_at, user_id, parent_id")
      .single()

    if (error || !inserted) {
      toast.error("Couldn’t post your reply — try again.")
      setReplySubmitting(false)
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single()

    const newId = inserted.id
    setComments((prev) => [
      ...prev,
      {
        ...inserted,
        parent_id: inserted.parent_id ?? parentId,
        profiles: profile ?? { display_name: null, avatar_url: null },
        forum_comment_likes: [{ count: 0 }],
      },
    ])
    setReplyBody("")
    setReplyingToId(null)
    setReplySubmitting(false)
    toast.success("Reply posted")
    scrollPostedCommentIntoView(newId, composerBarRef.current)
  }

  function onMainTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void submitTopLevel()
    }
  }

  function onReplyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, parentId: string) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void submitReply(parentId)
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return
    const supabase = createClient()
    const { error } = await supabase.from("forum_comments").delete().eq("id", commentId)
    if (!error) {
      setComments((prev) => {
        const target = prev.find((c) => c.id === commentId)
        if (!target) return prev
        if (target.parent_id == null) {
          return prev.filter((c) => c.id !== commentId && c.parent_id !== commentId)
        }
        return prev.filter((c) => c.id !== commentId)
      })
      setLikedIds((prev) => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
      if (replyingToId === commentId) {
        setReplyingToId(null)
        setReplyBody("")
      }
      toast.success("Removed")
    } else {
      toast.error("Couldn’t delete that comment.")
    }
  }

  const mainRemaining = MAX_LEN - body.length
  const replyRemaining = MAX_LEN - replyBody.length
  const bottomPad = Math.max(composerBarHeight, 1)

  return (
    <TooltipProvider delayDuration={280}>
      <div>
        <div
          className="border-t border-border pt-6"
          style={{ paddingBottom: bottomPad }}
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Comments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Scroll through the post — add a comment anytime from the bar at the bottom.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1 font-medium tabular-nums text-foreground">
                {topLevel.length} {topLevel.length === 1 ? "comment" : "comments"}
              </span>
              {replyCount > 0 ? (
                <span className="rounded-full border border-border/60 px-3 py-1 tabular-nums">
                  {replyCount} {replyCount === 1 ? "reply" : "replies"}
                </span>
              ) : null}
            </div>
          </div>

          {topLevel.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="list-none space-y-4 sm:space-y-5">
              {topLevel.map((c) => {
                const name = displayName(c)
                const initial = name.charAt(0).toUpperCase()
                const mine = currentUserId != null && c.user_id === currentUserId
                const nested = repliesByParent.get(c.id) ?? []
                return (
                  <li
                    key={c.id}
                    id={`comment-${c.id}`}
                    className="scroll-mt-20 rounded-xl border border-border/80 bg-card/50 px-3 py-4 sm:px-4 sm:py-5"
                  >
                    <div className="flex gap-3 sm:gap-4">
                      <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background sm:h-10 sm:w-10">
                        <AvatarImage src={c.profiles?.avatar_url || ""} alt="" />
                        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-foreground">{name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default text-xs text-muted-foreground tabular-nums">
                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {new Date(c.created_at).toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-[15px]">
                          {c.body}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <CommentLikeButton
                            commentId={c.id}
                            initialCount={likeCount(c)}
                            initialLiked={likedIds.has(c.id)}
                            isLoggedIn={isLoggedIn}
                          />
                          {isLoggedIn && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 rounded-full px-3 text-xs"
                              onClick={() => openReplyTo(c.id)}
                              aria-expanded={replyingToId === c.id}
                            >
                              <Reply className="h-3.5 w-3.5" aria-hidden />
                              Reply
                            </Button>
                          )}
                          {mine && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 rounded-full px-3 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => void deleteComment(c.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          )}
                        </div>

                        {replyingToId === c.id && isLoggedIn ? (
                          <div className="mt-4 rounded-lg border border-border/70 bg-muted/25 p-3 sm:p-4">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              Replying to <span className="text-foreground">{name}</span>
                            </p>
                            <Textarea
                              ref={replyTextareaRef}
                              value={replyBody}
                              onChange={(e) => setReplyBody(e.target.value.slice(0, MAX_LEN))}
                              onKeyDown={(e) => onReplyKeyDown(e, c.id)}
                              placeholder={`Reply to ${name}…`}
                              className="min-h-[80px] resize-y border-border/80 bg-background text-sm"
                              maxLength={MAX_LEN}
                              aria-label="Write a reply"
                            />
                            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                              <span
                                className={cn(
                                  "mr-auto text-xs tabular-nums text-muted-foreground",
                                  replyRemaining < 200 && "font-medium text-amber-700 dark:text-amber-400",
                                )}
                              >
                                {replyRemaining} left
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-full text-xs"
                                onClick={() => {
                                  setReplyingToId(null)
                                  setReplyBody("")
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 rounded-full px-4 text-xs"
                                disabled={replySubmitting || !replyBody.trim()}
                                onClick={() => void submitReply(c.id)}
                              >
                                {replySubmitting ? "Posting…" : "Post reply"}
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {nested.length > 0 ? (
                          <ul className="mt-4 space-y-3 border-l-2 border-border/60 pl-4 sm:pl-5">
                            {nested.map((r) => {
                              const rname = displayName(r)
                              const rinitial = rname.charAt(0).toUpperCase()
                              const rmine = currentUserId != null && r.user_id === currentUserId
                              return (
                                <li key={r.id} id={`comment-${r.id}`} className="scroll-mt-16">
                                  <div className="flex gap-2.5">
                                    <Avatar className="h-8 w-8 shrink-0">
                                      <AvatarImage src={r.profiles?.avatar_url || ""} alt="" />
                                      <AvatarFallback className="text-[10px]">{rinitial}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="text-sm font-medium text-foreground">{rname}</span>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                                        </span>
                                      </div>
                                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                        {r.body}
                                      </p>
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <CommentLikeButton
                                          commentId={r.id}
                                          initialCount={likeCount(r)}
                                          initialLiked={likedIds.has(r.id)}
                                          isLoggedIn={isLoggedIn}
                                          compact
                                        />
                                        {rmine && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 gap-1 rounded-full px-2 text-xs text-muted-foreground hover:text-destructive"
                                            onClick={() => void deleteComment(r.id)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            Delete
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div
          ref={composerBarRef}
          className={cn(
            "z-40 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/90",
            composerFixedToViewport ? "fixed bottom-0 rounded-b-lg" : "absolute inset-x-0 bottom-0 rounded-b-lg",
          )}
          style={
            composerFixedToViewport && articleDockRect
              ? {
                  left: articleDockRect.left,
                  width: articleDockRect.width,
                  bottom: 0,
                }
              : undefined
          }
          role="region"
          aria-label="Add a comment"
        >
          <div className="px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
            {isLoggedIn ? (
              <form onSubmit={(e) => void submitTopLevel(e)} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
                    onKeyDown={onMainTextareaKeyDown}
                    placeholder="Write a comment…"
                    rows={2}
                    className="min-h-[2.75rem] resize-y border-border/80 bg-background text-sm sm:min-h-[3.25rem]"
                    maxLength={MAX_LEN}
                    aria-label="Write a comment"
                  />
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <span
                      className={cn(
                        "text-[11px] tabular-nums text-muted-foreground",
                        mainRemaining < 200 && "font-medium text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {mainRemaining} left
                    </span>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={submitting || !body.trim()}
                  className="h-10 w-full shrink-0 rounded-full px-6 sm:h-10 sm:w-auto"
                >
                  {submitting ? "Posting…" : "Post comment"}
                </Button>
              </form>
            ) : (
              <p className="py-1 text-center text-sm text-muted-foreground sm:text-left">
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/board-talk")}`}
                  className="font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  Log in
                </Link>{" "}
                to comment.
              </p>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
