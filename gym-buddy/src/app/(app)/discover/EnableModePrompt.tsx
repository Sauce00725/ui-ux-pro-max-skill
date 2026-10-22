'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Heart, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { AppMode } from '@/lib/types'
import { enableMode } from './actions'

export function EnableModePrompt({ mode }: { mode: AppMode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const Icon = mode === 'dating' ? Heart : Users

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-card text-primary">
        <Icon className="size-8" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold uppercase">
        {mode === 'dating' ? 'Dating is off' : 'Training Partners is off'}
      </h1>
      <p className="mt-2 text-muted-fg">
        {mode === 'dating'
          ? 'Turn it on to see people who are open to dating. Your training partners stay separate.'
          : 'Turn it on to find training partners and friends nearby. No dating, ever.'}
      </p>
      <Button
        className="mt-6"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await enableMode(mode)
            if (res.ok) router.refresh()
            else setError(res.message)
          })
        }
      >
        Turn on {mode === 'dating' ? 'Dating' : 'Training Partners'}
      </Button>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  )
}
