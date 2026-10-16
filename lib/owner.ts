// WHO OWNS THE DATA. Every row has an owner_id and every query filters on
// it, so this one function decides whose notes a request can see.
//
// Today the owner is the BROWSER: proxy.ts gives each browser a random
// notebook id in a cookie, and this reads it back. On Day 17 only the BODY
// of getOwnerId() changes: it will read the signed-in user's session
// instead (or redirect to /login). Every query, Server Action and page that
// calls it stays exactly as it is.
import 'server-only'

import { cookies } from 'next/headers'
import { NOTEBOOK_COOKIE, isNotebookId } from '@/lib/notebook'

export async function getOwnerId(): Promise<string> {
  // cookies() is REQUEST-TIME data: nothing after it runs while the app is
  // built, so `next build` never needs the database.
  const value = (await cookies()).get(NOTEBOOK_COOKIE)?.value
  if (!isNotebookId(value)) {
    // proxy.ts sets this cookie on every request that lacks it, so this only
    // happens if a request skipped the proxy.
    throw new Error('This request has no notebook cookie.')
  }
  return value
}
