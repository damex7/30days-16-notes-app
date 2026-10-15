import Link from 'next/link'
import { cn } from '@/lib/cn'
import { listQueryString } from '@/lib/list-url'
import type { ListQuery, TagCount } from '@/lib/schema/note'

/**
 * Filter chips: one link per tag. Plain links that change ?tag=, so the
 * server does the filtering and the URL can be shared. Choosing the active
 * tag again clears the filter. Always links to the list (/), keeping any
 * search.
 */
export function TagFilter({ tags, query }: { tags: TagCount[]; query: ListQuery }) {
  const used = tags.filter((t) => t.noteCount > 0)
  if (used.length === 0) return null

  const chip = 'block shrink-0 whitespace-nowrap rounded-pill border px-3 py-1 text-sm no-underline transition-colors'
  return (
    <nav aria-label="Filter by tag" className="no-scrollbar -mx-3 overflow-x-auto px-3">
      <ul className="flex gap-1.5 py-1">
        <li>
          <Link
            href={`/${listQueryString({ q: query.q })}`}
            aria-current={!query.tag ? 'true' : undefined}
            className={cn(chip, !query.tag ? 'border-indigo bg-indigo text-on-indigo' : 'border-line text-muted hover:border-line-strong hover:text-ink')}
          >
            All
          </Link>
        </li>
        {used.map((t) => {
          const active = query.tag === t.name
          return (
            <li key={t.name}>
              <Link
                href={`/${listQueryString({ q: query.q, tag: active ? undefined : t.name })}`}
                aria-current={active ? 'true' : undefined}
                aria-label={active ? `#${t.name}, showing ${t.noteCount}. Choose again to show all.` : `#${t.name}, ${t.noteCount} ${t.noteCount === 1 ? 'note' : 'notes'}`}
                className={cn(chip, active ? 'border-indigo bg-indigo text-on-indigo' : 'border-line text-indigo hover:border-line-strong hover:bg-indigo-soft')}
              >
                #{t.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
