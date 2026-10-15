import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site/site-header'
import { button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = { title: 'Page not found' }

/** Any URL that matches no route. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col items-center justify-center">
        <EmptyState icon="note" title="There’s no page here">
          <p>The address may be mistyped, or the page has moved.</p>
        </EmptyState>
        <Link href="/" className={button.primary}>
          Back to your notes
        </Link>
      </main>
    </div>
  )
}
