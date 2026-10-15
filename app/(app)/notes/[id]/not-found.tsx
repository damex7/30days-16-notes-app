import Link from 'next/link'
import { button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/** A malformed or unknown note id: a calm 404, never a database error. */
export default function NoteNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <EmptyState icon="note" title="This note doesn’t exist">
        <p>It may have been deleted for good, or the link is wrong.</p>
      </EmptyState>
      <Link href="/" className={button.primary}>
        Back to your notes
      </Link>
    </div>
  )
}
