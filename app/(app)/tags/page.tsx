import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { PageFrame } from '@/components/site/page-frame'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeletons'
import { listQueryString } from '@/lib/list-url'
import { listTagsWithCounts } from '@/lib/notes'
import { getOwnerId } from '@/lib/owner'

export const metadata: Metadata = { title: 'Tags' }

export default function TagsPage() {
  return (
    <PageFrame
      title="Tags"
      intro="Every tag and how many notes use it, counted by PostgreSQL with GROUP BY. A tag disappears when its last note lets go of it."
    >
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <TagTable />
      </Suspense>
    </PageFrame>
  )
}

async function TagTable() {
  const ownerId = await getOwnerId()
  const tags = await listTagsWithCounts(ownerId)

  if (tags.length === 0) {
    return (
      <EmptyState icon="tag" title="No tags yet">
        <p>Add a tag to a note in the editor, under its title.</p>
      </EmptyState>
    )
  }

  const largest = Math.max(1, ...tags.map((t) => t.noteCount))
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line">
      {tags.map((tag) => (
        <li key={tag.name}>
          <Link
            href={`/${listQueryString({ tag: tag.name })}`}
            className="group flex items-center gap-4 px-2 py-3 no-underline hover:bg-sunken"
          >
            <span className="w-36 shrink-0 truncate font-semibold text-indigo sm:w-48">#{tag.name}</span>
            {/* A small bar chart of the counts: decorative, the number says it. */}
            <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-pill bg-sunken">
              <span className="block h-full rounded-pill bg-indigo" style={{ width: `${(tag.noteCount / largest) * 100}%` }} />
            </span>
            <span className="w-20 shrink-0 text-right text-sm text-muted tabular-nums">
              {tag.noteCount} {tag.noteCount === 1 ? 'note' : 'notes'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
