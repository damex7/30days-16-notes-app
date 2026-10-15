// ERROR BOUNDARY for every page in the app. If a query throws (the database
// is asleep, unreachable, or DATABASE_URL is wrong), this replaces the page
// content instead of crashing the whole app; the header stays.
//
// It must be a Client Component: it renders after the server gave up, and
// its "Try again" button runs in the browser.
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useEffect } from 'react'
import { button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-full border border-dashed border-danger text-danger">
        <Icon name="cloudOff" className="size-6" />
      </span>
      <h1 className="text-2xl">Couldn’t reach your notes</h1>
      <p className="mt-2 text-muted">
        The notes database didn’t answer. It may be waking up after a quiet spell, or the connection is down. Your notes are safe: nothing was
        changed.
      </p>
      {/* In production Next.js hides the real message from the browser; the
          digest matches the full error in the server logs. */}
      {error.digest ? <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={button.primary}
          // Re-run the server part (refresh) and the boundary (reset) together.
          onClick={() =>
            startTransition(() => {
              router.refresh()
              reset()
            })
          }
        >
          Try again
        </button>
        <Link href="/about" className={button.secondary}>
          About this demo
        </Link>
      </div>
    </div>
  )
}
