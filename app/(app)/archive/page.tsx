import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ShelfList } from '@/components/notes/shelf-list'
import { PageFrame } from '@/components/site/page-frame'
import { ListSkeleton } from '@/components/ui/skeletons'
import { listArchivedNotes } from '@/lib/notes'
import { getOwnerId } from '@/lib/owner'

export const metadata: Metadata = { title: 'Archive' }

export default function ArchivePage() {
  return (
    <PageFrame title="Archive" intro="Notes you’ve put away. They’re kept, just out of your main list.">
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <ArchivedNotes />
      </Suspense>
    </PageFrame>
  )
}

async function ArchivedNotes() {
  const ownerId = await getOwnerId()
  return <ShelfList kind="archive" notes={await listArchivedNotes(ownerId)} />
}
