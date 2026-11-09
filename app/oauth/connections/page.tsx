import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OAuthConnectionsList } from "@/components/features/mcp/oauth-connections-list"
import { listMcpConnectionsService } from "@/lib/services/mcpOAuth"
import { mcpResourceUrl } from "@/lib/services/mcpConfig"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Connected apps",
  description: "Manage AI assistants connected to your Reswell account.",
  path: "/oauth/connections",
})

export default async function McpOAuthConnectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/oauth/connections")
  }

  const connections = await listMcpConnectionsService(user.id)

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Connect apps
        </p>
        <h1 className="text-2xl font-medium tracking-tight">Connected apps</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Assistants connect through the Model Context Protocol at{" "}
          <code className="text-foreground">{mcpResourceUrl()}</code>. Disconnecting
          kills the token on the next call. The assistant never sees your password and
          cannot charge your card.
        </p>
      </div>

      <div className="mt-8">
        <OAuthConnectionsList connections={connections} />
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Shopping on the site?{" "}
        <Link href="/cart" className="underline underline-offset-4 hover:text-foreground">
          Open your cart
        </Link>
        .
      </p>
    </main>
  )
}
