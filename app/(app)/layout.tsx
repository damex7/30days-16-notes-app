// THE APP LAYOUT: header, keyboard shortcuts and the <main> landmark, shared
// by every page in the (app) route group. A route group's (parentheses) name
// never appears in the URL: this is the layout for /, /notes/[id], /archive,
// /trash, /tags and /about.
//
// On wide screens the layout is exactly one screen tall and <main> scrolls
// below a fixed header; the notes list and the editor then scroll
// separately (components/notes/notes-shell.tsx).

import { KeyboardShortcuts } from '@/components/site/keyboard-shortcuts'
import { SiteHeader } from '@/components/site/site-header'

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none lg:min-h-0 lg:overflow-y-auto">
        {children}
      </main>
      <KeyboardShortcuts />
    </div>
  )
}
