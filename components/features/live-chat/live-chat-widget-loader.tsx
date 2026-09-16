"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { LIVE_CHAT_ADMIN_ONLY_LABEL, LIVE_CHAT_WIDGET_ADMIN_ONLY } from "@/lib/live-chat/widget-config"

function LiveChatWidgetPlaceholder() {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-1.5"
      aria-hidden
    >
      {LIVE_CHAT_WIDGET_ADMIN_ONLY ? (
        <span className="rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          {LIVE_CHAT_ADMIN_ONLY_LABEL}
        </span>
      ) : null}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-listingHeart text-white shadow-lg">
        <MessageCircle className="h-6 w-6 opacity-80" />
      </div>
    </div>
  )
}

const LiveChatWidget = dynamic(
  () =>
    import("@/components/features/live-chat/live-chat-widget").then((m) => ({
      default: m.LiveChatWidget,
    })),
  { ssr: false, loading: () => <LiveChatWidgetPlaceholder /> },
)

function shouldShowLiveChatWidget(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname.startsWith("/admin")) return false
  if (pathname.startsWith("/embed")) return false
  return true
}

export function LiveChatWidgetLoader() {
  const pathname = usePathname()
  if (!shouldShowLiveChatWidget(pathname)) return null
  return <LiveChatWidget />
}
