// PROXY: runs on the server before any page renders. Two jobs:
//
// 1. GIVE EVERY BROWSER ITS OWN NOTEBOOK. On the first visit there is no
//    notebook cookie, so we make a random id and set it twice:
//    - on the REQUEST, so this very first render already knows whose
//      notebook it is (lib/owner.ts reads it with cookies());
//    - on the RESPONSE, so the browser keeps it for next time.
//    The cookie is httpOnly (page JavaScript can't read or steal it),
//    secure (HTTPS only, in production), and sameSite=lax (other sites
//    can't make a request that uses it to change your notes).
//
// 2. A REAL 404 FOR A MALFORMED NOTE ID (/notes/hello), before rendering
//    starts. The editor page streams: its static shell is sent with a 200
//    status before the database answers, so notFound() inside the page can
//    show the not-found screen but can no longer change the status. An id
//    that isn't even a UUID can be rejected here without asking the
//    database. (An unknown but well-formed id still needs the database: that
//    case shows the not-found screen from the page.)
import { NextResponse, type NextRequest } from 'next/server'
import { NOTEBOOK_COOKIE, NOTEBOOK_COOKIE_MAX_AGE, isNotebookId, isUuid } from '@/lib/notebook'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const noteId = pathname.startsWith('/notes/') ? (pathname.split('/')[2] ?? '') : null

  const response =
    noteId !== null && !isUuid(noteId)
      ? // A path no route matches, so Next.js renders app/not-found.tsx and
        // the address bar keeps the original URL. The status is set
        // explicitly: on Vercel the prerendered 404 page is otherwise
        // served with 200.
        NextResponse.rewrite(new URL('/404', request.url), { status: 404 })
      : null

  if (isNotebookId(request.cookies.get(NOTEBOOK_COOKIE)?.value)) {
    return response ?? NextResponse.next()
  }

  // First visit (or a missing, damaged or forbidden cookie): a new notebook.
  const notebookId = crypto.randomUUID()
  request.cookies.set(NOTEBOOK_COOKIE, notebookId)
  const next = response ?? NextResponse.next({ request: { headers: request.headers } })
  next.cookies.set({
    name: NOTEBOOK_COOKIE,
    value: notebookId,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: NOTEBOOK_COOKIE_MAX_AGE,
  })
  return next
}

export const config = {
  // Every page and Server Action, but not the files Next.js serves itself
  // (scripts, styles, fonts, images, the icon).
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'],
}
