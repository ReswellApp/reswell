'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SellerResponseFormProps {
  claimId: string
}

export function SellerResponseForm({ claimId }: SellerResponseFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'accept' | 'respond' | null>(null)
  const [response, setResponse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!action) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/protection/claims/${claimId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            seller_response: response || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong.')
          return
        }
        setDone(true)
        router.refresh()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  if (done) {
    return (
      <Card className="border-green-200 bg-green-50/60 dark:border-green-800/40 dark:bg-green-950/20">
        <CardContent className="pt-5 text-sm text-green-800 dark:text-green-300">
          {action === 'accept'
            ? 'You accepted the claim. The refund will be processed.'
            : 'Your response has been submitted. Our team will review within 3 business days.'}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="text-base text-amber-900 dark:text-amber-300">
          Respond to this claim
        </CardTitle>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
          You have 48 hours to respond. Not responding may result in automatic approval.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action choice */}
        <div className="space-y-2">
          {[
            {
              value: 'accept' as const,
              label: 'Accept the claim',
              desc: 'I agree to the refund. Reswell will process it from the protection fund.',
            },
            {
              value: 'respond' as const,
              label: 'Provide counter-evidence',
              desc: 'I dispute this claim and want to share my side of the story.',
            },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAction(opt.value)}
              className={`w-full text-left rounded-lg border p-3 transition-all text-sm ${
                action === opt.value
                  ? 'border-amber-500 bg-amber-100 dark:border-amber-600 dark:bg-amber-900/40'
                  : 'border-amber-200 hover:border-amber-400 dark:border-amber-800/40'
              }`}
            >
              <p className="font-medium text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>

        {action === 'respond' && (
          <div className="space-y-1.5">
            <label htmlFor="seller-response" className="text-sm font-medium">
              Your response
            </label>
            <textarea
              id="seller-response"
              rows={5}
              placeholder="Explain what happened. Include tracking info, photos, or any messages with the buyer that support your case."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <Button
          disabled={
            !action ||
            isPending ||
            (action === 'respond' && response.trim().length < 20)
          }
          onClick={handleSubmit}
          className="w-full"
        >
          {isPending ? 'Submitting…' : action === 'accept' ? 'Accept claim' : 'Submit response'}
        </Button>
      </CardContent>
    </Card>
  )
}
