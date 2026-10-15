// CLIENT COMPONENT: the archive and trash lists, where each action removes
// the note from view at once (useOptimistic) while the Server Action runs.
'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { deleteForeverAction, emptyTrashAction, restoreAction, setArchivedAction } from '@/app/(app)/actions'
import { button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { shortDate } from '@/lib/format'
import type { NoteSummary } from '@/lib/schema/note'

type Removal = { type: 'one'; id: string } | { type: 'all' }

export function ShelfList({ notes, kind }: { notes: NoteSummary[]; kind: 'archive' | 'trash' }) {
  const [visible, remove] = useOptimistic(notes, (items: NoteSummary[], removal: Removal) =>
    removal.type === 'all' ? [] : items.filter((n) => n.id !== removal.id),
  )
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState<string | 'all' | null>(null)
  const [announcement, setAnnouncement] = useState('')

  function run(removal: Removal, action: () => Promise<unknown>, done: string) {
    setConfirm(null)
    startTransition(async () => {
      remove(removal)
      try {
        await action()
        setAnnouncement(done)
      } catch {
        setAnnouncement("Couldn't reach the database. Nothing was changed.")
      }
    })
  }

  if (visible.length === 0) {
    return kind === 'trash' ? (
      <EmptyState icon="trash" title="The trash is empty">
        <p>Notes you delete wait here until you restore them or delete them for good.</p>
      </EmptyState>
    ) : (
      <EmptyState icon="archive" title="Nothing archived">
        <p>Archive a note to keep it without seeing it in your main list. It stays searchable from here.</p>
      </EmptyState>
    )
  }

  return (
    <>
      {kind === 'trash' ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sheet border border-line bg-sunken px-4 py-3">
          <p className="text-sm text-muted">
            {visible.length} {visible.length === 1 ? 'note' : 'notes'} in the trash.
          </p>
          {confirm === 'all' ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Confirm emptying the trash">
              <button
                type="button"
                disabled={pending}
                className={button.danger}
                onClick={() => run({ type: 'all' }, emptyTrashAction, 'The trash is empty. Those notes are gone for good.')}
              >
                Yes, delete all forever
              </button>
              <button type="button" className={button.ghost} onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className={button.secondary} onClick={() => setConfirm('all')}>
              <Icon name="trash" className="size-4.5" />
              Empty trash…
            </button>
          )}
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {visible.map((note) => {
          const title = note.title || 'Untitled'
          return (
            <li key={note.id} className="flex flex-col gap-3 rounded-sheet border border-line bg-raised p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <Link href={`/notes/${note.id}`} className={cn('font-display text-lg text-ink', !note.title && 'text-muted italic')}>
                  {title}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{note.preview || 'Empty note'}</p>
                <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-muted">
                  <span suppressHydrationWarning>
                    {kind === 'trash' && note.deletedAt ? `Deleted ${shortDate(note.deletedAt)}` : `Edited ${shortDate(note.updatedAt)}`}
                  </span>
                  {note.tags.map((t) => (
                    <span key={t} className="text-indigo">
                      #{t}
                    </span>
                  ))}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {kind === 'archive' ? (
                  <button
                    type="button"
                    className={button.secondary}
                    aria-label={`Unarchive “${title}”`}
                    onClick={() => run({ type: 'one', id: note.id }, () => setArchivedAction(note.id, false), `“${title}” is back in your notes.`)}
                  >
                    <Icon name="unarchive" className="size-4.5" />
                    Unarchive
                  </button>
                ) : confirm === note.id ? (
                  <>
                    <button
                      type="button"
                      className={button.danger}
                      aria-label={`Yes, delete “${title}” forever`}
                      onClick={() => run({ type: 'one', id: note.id }, () => deleteForeverAction(note.id), `“${title}” was deleted for good.`)}
                    >
                      Delete forever
                    </button>
                    <button type="button" className={button.ghost} onClick={() => setConfirm(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={button.secondary}
                      aria-label={`Restore “${title}”`}
                      onClick={() => run({ type: 'one', id: note.id }, () => restoreAction(note.id), `“${title}” was restored.`)}
                    >
                      <Icon name="restore" className="size-4.5" />
                      Restore
                    </button>
                    <button type="button" className={button.ghost} aria-label={`Delete “${title}” forever…`} onClick={() => setConfirm(note.id)}>
                      Delete…
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  )
}
