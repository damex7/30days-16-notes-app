import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The two-pane layout shared by / and /notes/[id].
 * - Wide screens (lg and up): the list on the left, the editor on the right,
 *   each scrolling on its own, like a desktop notes app.
 * - Phones and tablets: ONE pane at a time, scrolling with the page. On /
 *   that's the list; on /notes/[id] it's the editor, with a "Notes" link
 *   back. `pane` says which one this page is about.
 */
export function NotesShell({ pane, list, children }: { pane: 'list' | 'editor'; list: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(20rem,25rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <section
        aria-labelledby="notes-list-heading"
        className={cn('flex min-w-0 flex-col lg:overflow-y-auto lg:border-r lg:border-line', pane === 'editor' && 'max-lg:hidden')}
      >
        {list}
      </section>
      <div className={cn('flex min-w-0 flex-col lg:overflow-y-auto', pane === 'list' && 'max-lg:hidden')}>{children}</div>
    </div>
  )
}
