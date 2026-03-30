"use client"

import dynamic from "next/dynamic"

// Dynamic import with ssr:false must live in a Client Component.
// This wrapper is the client boundary; layout.tsx (Server Component) imports this.
const PresenceHeartbeat = dynamic(
  () => import("@/components/presence-heartbeat").then((m) => ({ default: m.PresenceHeartbeat })),
  { ssr: false },
)

export function PresenceHeartbeatLoader() {
  return <PresenceHeartbeat />
}
