"use client"

import { useTransition } from "react"
import { revokeMcpConnectionAction } from "@/lib/actions/mcpOAuthActions"
import { Button } from "@/components/ui/button"
import { MCP_SCOPE_META, type McpConnectionSummary } from "@/lib/types/mcp"

type OAuthConnectionsListProps = {
  connections: McpConnectionSummary[]
}

export function OAuthConnectionsList({ connections }: OAuthConnectionsListProps) {
  const [pending, startTransition] = useTransition()

  if (connections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No assistants are connected yet. When Grok, Claude, ChatGPT, or Cursor asks to
        use Reswell, you will approve permissions here via Sign in with Reswell.
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {connections.map((connection) => (
        <li
          key={connection.tokenId}
          className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{connection.clientName}</p>
            <p className="text-xs text-muted-foreground">
              Connected {new Date(connection.createdAt).toLocaleString()}
              {connection.lastUsedAt
                ? ` · Last used ${new Date(connection.lastUsedAt).toLocaleString()}`
                : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {connection.scopes.map((scope) => MCP_SCOPE_META[scope].title).join(" · ")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await revokeMcpConnectionAction(connection.tokenId)
              })
            }}
          >
            Disconnect
          </Button>
        </li>
      ))}
    </ul>
  )
}
