import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ShelfList } from '@/components/notes/shelf-list'
import { PageFrame } from '@/components/site/page-frame'
import { ListSkeleton } from '@/components/ui/skeletons'
import { listTrashedNotes } from '@/lib/notes'
import { getOwnerId } from '@/lib/owner'

export const metadata: Metadata = { title: 'Trash' }

export default function TrashPage() {
  return (
    <PageFrame title="Trash" intro="Deleted notes wait here. Restore them, or delete them for good.">
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <TrashedNotes />
      </Suspense>
    </PageFrame>
  )
}

async function TrashedNotes() {
  const ownerId = await getOwnerId()
  return <ShelfList kind="trash" notes={await listTrashedNotes(ownerId)} />
}
