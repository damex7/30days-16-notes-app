import Link from 'next/link'
import { Suspense } from 'react'
import { NewNoteButton } from '@/components/notes/new-note-button'
import { NoteList } from '@/components/notes/note-list'
import { SampleNotesButton } from '@/components/notes/sample-notes-button'
import { SearchBox, SearchBoxFallback } from '@/components/notes/search-box'
import { TagFilter } from '@/components/notes/tag-filter'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeletons'
import { listQueryString } from '@/lib/list-url'
import { listNotes, listTagsWithCounts, searchNotes } from '@/lib/notes'
import { getOwnerId } from '@/lib/owner'
import { ListQuerySchema } from '@/lib/schema/note'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * The list pane: search and "New note" on top (static shell), then the
 * notes, which stream in. Pages pass their searchParams PROMISE down rather
 * than awaiting it, so everything above the <Suspense> renders immediately.
 */
export function NotesListPane({ searchParams, activeId }: { searchParams: SearchParams; activeId?: Promise<string> }) {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-paper px-3 py-3">
        <Suspense fallback={<SearchBoxFallback />}>
          <SearchBox />
        </Suspense>
        <NewNoteButton className="shrink-0" />
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <NotesListSection searchParams={searchParams} activeId={activeId} />
      </Suspense>
    </>
  )
}

/**
 * SERVER COMPONENT that reads the database: it awaits the URL, then asks
 * lib/notes.ts for either search results or a page of the list, plus the
 * tags for the filter chips. Both queries run at the same time.
 *
 * Compare Days 12–15: a page called `await getDishes(query)` from lib/data.ts.
 * The shape is identical; only lib/notes.ts knows there is SQL behind it.
 */
async function NotesListSection({ searchParams, activeId }: { searchParams: SearchParams; activeId?: Promise<string> }) {
  const [raw, active] = await Promise.all([searchParams, activeId])
  const query = ListQuerySchema.parse(raw)
  const queryString = listQueryString(query)
  const ownerId = await getOwnerId()

  const [tags, results] = await Promise.all([
    listTagsWithCounts(ownerId),
    query.q ? searchNotes(ownerId, query.q, query.tag).then((hits) => ({ notes: hits, nextCursor: null })) : listNotes(ownerId, { tag: query.tag }),
  ])

  const heading = query.q
    ? `${results.notes.length === 50 ? 'Top 50' : results.notes.length} ${results.notes.length === 1 ? 'result' : 'results'} for “${query.q}”`
    : query.tag
      ? `Notes tagged #${query.tag}`
      : 'All notes'

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
        <TagFilter tags={tags} query={query} />
        <h2 id="notes-list-heading" className="px-1 pt-1 text-sm font-semibold text-muted [font-family:var(--font-sans)]" aria-live="polite">
          {heading}
        </h2>
      </div>

      {results.notes.length === 0 ? (
        query.q ? (
          <EmptyState icon="search" title="Nothing matches">
            <p>
              No notes contain “{query.q}”{query.tag ? ` with the tag #${query.tag}` : ''}. Try fewer words, or{' '}
              <Link href={`/${listQueryString({ tag: query.tag })}`}>clear the search</Link>.
            </p>
            <p className="mt-2">Tip: use quotes for a phrase (“egusi soup”) and a minus to leave a word out (beans -moi).</p>
          </EmptyState>
        ) : query.tag ? (
          <EmptyState icon="tag" title={`No notes tagged #${query.tag}`}>
            <p>
              <Link href="/">Show all notes</Link>
            </p>
          </EmptyState>
        ) : (
          <EmptyState icon="note" title="Your notebook is empty">
            <p>Write down the shopping list, the lecture, the idea in the shower. Ìrántí keeps it, privately, in this browser.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <NewNoteButton withId={false} />
              <SampleNotesButton />
            </div>
          </EmptyState>
        )
      ) : (
        <NoteList
          // A new search or filter starts a new list: "Load more" pages from
          // the old one are thrown away.
          key={queryString}
          notes={results.notes}
          nextCursor={results.nextCursor}
          tag={query.tag}
          queryString={queryString}
          activeId={active}
          mode={query.q ? 'search' : 'list'}
        />
      )}
    </div>
  )
}
