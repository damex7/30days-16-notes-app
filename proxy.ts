// PROXY: runs before any page renders. Here it does one job: a malformed
// note id (/notes/hello) gets a real 404 STATUS before rendering starts.
//
// Why here and not only in the page? The editor page streams: its static
// shell (header, search box) is sent with a 200 status before the database
// answers. notFound() inside the page still shows the not-found screen, with
// a noindex tag, but the status is already sent. An id that isn't even a
// UUID can be rejected without asking the database, so we do it before the
// first byte. (An unknown but well-formed id still needs the database: that
// case shows the not-found screen from the page.)
import { NextResponse, type NextRequest } from 'next/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.split('/')[2] ?? ''
  if (UUID.test(id)) return NextResponse.next()
  // Rewrite to a path no route matches: Next.js renders app/not-found.tsx
  // with status 404, and the address bar keeps the original URL.
  return NextResponse.rewrite(new URL('/404', request.url))
}

export const config = {
  matcher: '/notes/:id',
}
