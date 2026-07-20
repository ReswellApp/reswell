'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageCircle } from 'lucide-react'
import { reportClientError } from '@/lib/utils/reportClientError'

export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [referenceCode, setReferenceCode] = useState<string | null>(null)

  useEffect(() => {
    console.error('[messages] page error:', error)
    void reportClientError({
      name: error.name,
      message: error.message || 'Messages route error',
      stack: error.stack,
      digest: error.digest,
      context: { boundary: 'app/messages/error' },
    }).then((result) => {
      if (result?.referenceCode) setReferenceCode(result.referenceCode)
    })
  }, [error])

  return (
    <main className="flex flex-1 flex-col bg-background">
      <div className="container mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-5">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <MessageCircle className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <h2 className="text-[20px] font-semibold tracking-tight text-foreground">
          Couldn&apos;t load your inbox
        </h2>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          Something went wrong loading your messages. Try again and it should resolve.
        </p>
        <Button
          onClick={reset}
          className="mt-6 rounded-full"
          variant="outline"
        >
          Try again
        </Button>
        {(referenceCode || error.digest) && (
          <p className="mt-6 text-xs text-muted-foreground">
            Ref: {referenceCode ?? error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
