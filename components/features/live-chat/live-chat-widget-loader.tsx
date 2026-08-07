"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

function LiveChatWidgetPlaceholder() {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
      aria-hidden
    >
      <MessageCircle className="h-6 w-6 opacity-80" />
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
