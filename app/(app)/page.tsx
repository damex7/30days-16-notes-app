// / : the notes list, with search (?q=) and tag filter (?tag=).
//
// The page itself is synchronous: it hands the searchParams PROMISE to the
// list pane, whose database part streams in inside <Suspense>. Everything
// else (header, search box, "New note") is the static shell.

import type { Metadata } from 'next'
import { NotesListPane } from '@/components/notes/notes-list-pane'
import { NotesShell } from '@/components/notes/notes-shell'
import { Icon } from '@/components/ui/icon'

export const metadata: Metadata = { title: 'Notes' }

export default function NotesPage({ searchParams }: PageProps<'/'>) {
  return (
    <NotesShell pane="list" list={<NotesListPane searchParams={searchParams} />}>
      <h1 className="sr-only">Your notes</h1>
      {/* Wide screens only: the empty right-hand pane. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-muted">
        <span className="grid size-16 place-items-center rounded-full border border-dashed border-line-strong">
          <Icon name="note" className="size-7" />
        </span>
        <p className="font-display text-2xl text-ink">Pick a note, or start a new one.</p>
        <p className="text-sm">
          Press <kbd className="rounded border border-line-strong px-1.5 font-sans text-xs">n</kbd> for a new note and{' '}
          <kbd className="rounded border border-line-strong px-1.5 font-sans text-xs">/</kbd> to search.
        </p>
      </div>
    </NotesShell>
  )
}
