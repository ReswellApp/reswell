'use client'

import { useSyncExternalStore } from 'react'

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function subscribe() {
  return () => {}
}

function getGreetingSnapshot(): string {
  return greetingForHour(new Date().getHours())
}

function getGreetingServerSnapshot(): string {
  return 'Good morning'
}

interface AdminHomeGreetingProps {
  displayName?: string | null
}

export function AdminHomeGreeting({ displayName }: AdminHomeGreetingProps) {
  const greeting = useSyncExternalStore(
    subscribe,
    getGreetingSnapshot,
    getGreetingServerSnapshot,
  )
  const headline = displayName ? `${greeting}, ${displayName}` : greeting

  return (
    <h1 className="relative text-3xl font-bold tracking-tight">{headline}!</h1>
  )
}
