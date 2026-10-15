// WHO OWNS THE DATA. There are no accounts yet (Day 17 adds them), but every
// row already has an owner_id and every query already filters on it. Today
// that ID is one fixed demo owner, so everyone who opens the demo shares the
// same notes.
//
// On Day 17 only the BODY of getOwnerId() changes: it will read the session
// cookie and return the signed-in user's ID (or redirect to /login). Every
// query, Server Action and page that calls it stays exactly as it is.
import 'server-only'

import { connection } from 'next/server'

/** A fixed UUID for the shared demo owner (the 16 is for Day 16). */
export const DEMO_OWNER_ID = '00000000-0000-4000-8000-000000000016'

export async function getOwnerId(): Promise<string> {
  // connection() marks this as REQUEST-TIME work: nothing after it runs while
  // the app is built, so `next build` never needs the database. Day 17's
  // cookies() call will do the same job.
  await connection()
  return DEMO_OWNER_ID
}
