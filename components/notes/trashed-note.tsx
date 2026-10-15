// CLIENT COMPONENT: restore and delete-forever buttons with pending states.
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { deleteForeverAction, restoreAction } from '@/app/(app)/actions'
import { button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { longDate } from '@/lib/format'
import type { Note } from '@/lib/schema/note'

/** A note in the trash opens read-only, with the way out. */
export function TrashedNote({ note }: { note: Note }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  return (
    <article className="mx-auto w-full max-w-reading px-4 py-6 sm:px-6">
      <Link href="/trash" className={cn(button.ghost, 'px-3')}>
        <Icon name="arrowLeft" className="size-4.5" />
        Trash
      </Link>
      <div className="mt-4 rounded-sheet border border-line bg-sunken p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Icon name="trash" />
          This note is in the trash
        </p>
        {note.deletedAt ? <p className="mt-1 text-sm text-muted">Moved there {longDate(note.deletedAt)}. Restore it to edit it again.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            // restoreAction expires the trash and list caches; refreshing
            // re-renders this route, which now finds a live note and
            // shows the editor.
            onClick={() => startTransition(async () => void (await restoreAction(note.id)))}
            className={button.primary}
          >
            <Icon name="restore" className="size-4.5" />
            Restore
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteForeverAction(note.id)
                    router.push('/trash')
                  })
                }
                className={button.danger}
              >
                Yes, delete forever
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={button.ghost}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={button.secondary}>
              Delete forever…
            </button>
          )}
        </div>
      </div>

      <h1 className="mt-8 text-3xl text-muted">{note.title || 'Untitled'}</h1>
      <p className="mt-4 text-[1.0625rem] leading-[1.8] whitespace-pre-wrap text-muted">{note.body}</p>
    </article>
  )
}
