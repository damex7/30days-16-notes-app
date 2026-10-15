// CLIENT COMPONENT: the list responds to clicks instantly (useOptimistic)
// and fetches more pages on demand.
'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { loadMoreAction, setArchivedAction, setPinnedAction } from '@/app/(app)/actions'
import { Highlighted } from '@/components/notes/highlighted'
import { button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { shortDate } from '@/lib/format'
import type { NoteSummary, SearchHit } from '@/lib/schema/note'

type Item = NoteSummary | SearchHit
type Change = { type: 'pin'; id: string; pinned: boolean } | { type: 'remove'; id: string }

const isHit = (item: Item): item is SearchHit => 'snippet' in item

/** The list's order: pinned first, then most recently edited, then id. */
function byListOrder(a: Item, b: Item): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  const time = b.updatedAt.getTime() - a.updatedAt.getTime()
  if (time !== 0) return time
  return a.id < b.id ? 1 : -1
}

/**
 * How a change LOOKS before the server confirms it. React shows this result
 * while the Server Action runs, then throws it away and shows the server's
 * fresh list. If the action fails, the optimistic version simply disappears
 * and the note snaps back.
 */
function applyChange(items: Item[], change: Change, keepOrder: boolean): Item[] {
  switch (change.type) {
    case 'pin': {
      const next = items.map((n) => (n.id === change.id ? { ...n, pinned: change.pinned } : n))
      // Search results stay in relevance order; the list re-sorts.
      return keepOrder ? next : next.toSorted(byListOrder)
    }
    case 'remove':
      return items.filter((n) => n.id !== change.id)
  }
}

type Props = {
  /** The first page, from the server. */
  notes: Item[]
  nextCursor: string | null
  tag: string | undefined
  /** ?q=...&tag=... carried into note links. */
  queryString: string
  activeId: string | undefined
  mode: 'list' | 'search'
}

export function NoteList({ notes, nextCursor, tag, queryString, activeId, mode }: Props) {
  // Pages fetched with "Load more", kept in the browser and appended.
  const [more, setMore] = useState<{ notes: NoteSummary[]; nextCursor: string | null } | null>(null)
  const [loading, startLoading] = useTransition()
  const [, startAction] = useTransition()
  const [announcement, setAnnouncement] = useState('')

  // When a Server Action updates the first page (it re-renders with fresh
  // props), a note that moved into it is dropped from the extra pages so it
  // never shows twice.
  const firstIds = new Set(notes.map((n) => n.id))
  const all: Item[] = [...notes, ...(more?.notes.filter((n) => !firstIds.has(n.id)) ?? [])]
  const cursor = more ? more.nextCursor : nextCursor

  const [visible, addChange] = useOptimistic(all, (items: Item[], change: Change) => applyChange(items, change, mode === 'search'))

  function run(change: Change, action: () => Promise<boolean>, done: string) {
    startAction(async () => {
      addChange(change)
      try {
        const ok = await action()
        setAnnouncement(ok ? done : 'That note was changed elsewhere. The list has been refreshed.')
      } catch {
        setAnnouncement("Couldn't reach the database. Nothing was changed.")
      }
    })
  }

  function loadMore() {
    if (!cursor) return
    startLoading(async () => {
      try {
        const page = await loadMoreAction(cursor, tag)
        setMore((prev) => ({ notes: [...(prev?.notes ?? []), ...page.notes], nextCursor: page.nextCursor }))
        setAnnouncement(`Loaded ${page.notes.length} more ${page.notes.length === 1 ? 'note' : 'notes'}.`)
      } catch {
        setAnnouncement("Couldn't load more notes. Try again.")
      }
    })
  }

  return (
    <>
      <ul className="flex flex-col">
        {visible.map((note) => {
          const title = note.title || 'Untitled'
          const active = note.id === activeId
          return (
            <li key={note.id} className="group relative border-b border-line motion-safe:animate-rise">
              <Link
                href={`/notes/${note.id}${queryString}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block border-l-[3px] py-3 pr-24 pl-4 no-underline transition-colors',
                  active ? 'border-indigo bg-indigo-soft' : 'border-transparent hover:bg-sunken',
                )}
              >
                <span className="flex items-center gap-2">
                  {note.pinned ? (
                    <span className="shrink-0 rounded-[0.25rem] bg-lime px-1.5 py-px text-[0.7rem] font-semibold tracking-wide text-on-lime uppercase">
                      Pinned
                    </span>
                  ) : null}
                  <span className={cn('truncate font-display text-[1.05rem]', !note.title && 'text-muted italic')}>
                    {isHit(note) && note.title ? <Highlighted text={note.titleHighlight} /> : title}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 text-sm leading-snug text-muted">
                  {isHit(note) ? <Highlighted text={note.snippet} /> : note.preview || 'Empty note'}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <time dateTime={note.updatedAt.toISOString()} suppressHydrationWarning>
                    {shortDate(note.updatedAt)}
                  </time>
                  {note.tags.map((t) => (
                    <span key={t} className="text-indigo">
                      #{t}
                    </span>
                  ))}
                </span>
              </Link>

              {/* Row actions: always visible on touch screens; on devices
                  with a mouse they appear on hover or keyboard focus. */}
              <div className="absolute top-1.5 right-1.5 flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                <button
                  type="button"
                  className={cn(button.icon, 'size-10', note.pinned && 'text-ink')}
                  aria-pressed={note.pinned}
                  aria-label={`${note.pinned ? 'Unpin' : 'Pin'} “${title}”`}
                  title={note.pinned ? 'Unpin' : 'Pin to top'}
                  onClick={() =>
                    run(
                      { type: 'pin', id: note.id, pinned: !note.pinned },
                      () => setPinnedAction(note.id, !note.pinned),
                      `${note.pinned ? 'Unpinned' : 'Pinned'} “${title}”.`,
                    )
                  }
                >
                  <Icon name="pin" className={cn('size-4.5', note.pinned && 'fill-lime')} />
                </button>
                <button
                  type="button"
                  className={cn(button.icon, 'size-10')}
                  aria-label={`Archive “${title}”`}
                  title="Archive"
                  onClick={() => run({ type: 'remove', id: note.id }, () => setArchivedAction(note.id, true), `Archived “${title}”.`)}
                >
                  <Icon name="archive" className="size-4.5" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {cursor ? (
        <div className="flex justify-center p-4">
          <button type="button" onClick={loadMore} disabled={loading} className={button.secondary}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}

      {/* Announces what just happened to screen-reader users. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  )
}
