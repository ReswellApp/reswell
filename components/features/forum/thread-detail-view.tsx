"use client"

import { useCallback, useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThreadLikeButton } from "@/components/forum/thread-like-button"
import { ThreadCommentsPanel, type ThreadCommentRow } from "@/components/forum/thread-comments-panel"
import { LinkifiedText } from "@/components/forum/linkified-text"
import { ThreadDeleteButton } from "@/components/forum/thread-delete-button"
import { AdminThreadEditor } from "@/components/forum/admin-thread-editor"
import { ThreadPostEngagementFooter } from "@/components/features/forum/thread-post-engagement-footer"
import { ForumCommentMediaCard } from "@/components/features/forum/forum-comment-media-card"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { useThreadsPageLabel } from "@/components/features/forum/threads-breadcrumb-provider"
import { capitalizeWords } from "@/lib/listing-labels"
import type { ForumThreadParticipant } from "@/lib/services/forumThreads"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { threadsMarkerClassName } from "@/components/features/forum/threads-brand-styles"
import { countUrlsInText } from "@/lib/utils/count-urls-in-text"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type ThreadOpeningPhoto = {
  commentId: string
  fileName: string
  body: string
}

type ThreadDetailViewProps = {
  threadId: string
  threadSlug: string
  title: string
  body: string | null
  openingPhoto?: ThreadOpeningPhoto | null
  createdAt: string
  authorName: string
  authorAvatarUrl: string | null
  threadLikeCount: number
  threadLiked: boolean
  isLoggedIn: boolean
  isAdmin: boolean
  canDeleteThread: boolean
  comments: ThreadCommentRow[]
  currentUserId: string | null
  likedCommentIds: string[]
  participants: ForumThreadParticipant[]
  participantCount: number
}

export function ThreadDetailView({
  threadId,
  threadSlug,
  title,
  body,
  openingPhoto,
  createdAt,
  authorName,
  authorAvatarUrl,
  threadLikeCount,
  threadLiked,
  isLoggedIn,
  isAdmin,
  canDeleteThread,
  comments,
  currentUserId,
  likedCommentIds,
  participants,
  participantCount,
}: ThreadDetailViewProps) {
  const openSignIn = useSignInGate()
  const authorInitial = authorName.charAt(0).toUpperCase()
  const replyCount = comments.filter((c) => c.parent_id == null).length
  const linkCount = useMemo(() => countUrlsInText(body), [body])

  useThreadsPageLabel(title)

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied")
    } catch {
      toast.error("Could not copy link")
    }
  }, [])

  function scrollToComposer() {
    if (!isLoggedIn) {
      openSignIn(null)
      return
    }
    const composer = document.getElementById("thread-composer")
    composer?.scrollIntoView({ behavior: "smooth", block: "center" })
    window.setTimeout(() => {
      composer?.querySelector("textarea")?.focus()
    }, 350)
  }

  const adminMenu =
    isAdmin || canDeleteThread ? (
      <div className="flex flex-col gap-1 p-1">
        {isAdmin ? (
          <AdminThreadEditor threadId={threadId} initialTitle={title} initialBody={body ?? ""} />
        ) : null}
        {canDeleteThread ? <ThreadDeleteButton threadId={threadId} /> : null}
      </div>
    ) : undefined

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", threadsMarkerClassName)} aria-hidden />
          <span className="font-medium text-muted-foreground">Community</span>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          {capitalizeWords(title)}
        </h1>
      </header>

      <article className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex gap-3 sm:gap-4">
            <Avatar className="h-10 w-10 shrink-0 sm:h-11 sm:w-11">
              <AvatarImage src={profileMediaDisplaySrc(authorAvatarUrl || "")} alt="" />
              <AvatarFallback>{authorInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{authorName}</p>
                <time className="text-xs tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                </time>
              </div>
              {openingPhoto ? (
                <div className="mt-4">
                  <ForumCommentMediaCard
                    commentId={openingPhoto.commentId}
                    fileName={openingPhoto.fileName}
                    body={openingPhoto.body}
                  />
                </div>
              ) : null}
              {!openingPhoto && body?.trim() ? (
                <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-[15px]">
                  <LinkifiedText text={body} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <ThreadPostEngagementFooter
          replyCount={replyCount}
          likeCount={threadLikeCount}
          linkCount={linkCount}
          participantCount={participantCount}
          participants={participants}
          onReply={scrollToComposer}
          onShare={() => void copyLink()}
          likeControl={
            <ThreadLikeButton
              threadId={threadId}
              initialCount={threadLikeCount}
              initialLiked={threadLiked}
              isLoggedIn={isLoggedIn}
              compact
            />
          }
          adminMenu={adminMenu}
        />
      </article>

      <ThreadCommentsPanel
        threadId={threadId}
        threadSlug={threadSlug}
        initialComments={comments}
        currentUserId={currentUserId}
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
        likedCommentIds={likedCommentIds}
      />
    </div>
  )
}
