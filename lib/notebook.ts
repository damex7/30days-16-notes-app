// ONE NOTEBOOK PER BROWSER. Until accounts arrive (Day 17), each browser gets
// its own random owner id, kept in a cookie. Whoever holds the cookie owns
// the notes: there is no password, so the id itself is the secret. A random
// UUID has 122 random bits, so nobody can guess someone else's.
//
// This file has no `server-only` import on purpose: proxy.ts runs outside
// React's server environment, and the `server-only` package would refuse
// to load there. It only holds constants and a check, nothing secret.

export const NOTEBOOK_COOKIE = 'iranti-notebook'

/** 400 days, the longest a browser will keep a cookie. */
export const NOTEBOOK_COOKIE_MAX_AGE = 60 * 60 * 24 * 400

/**
 * The sample notebook that `npm run db:seed` fills. New notebooks can copy
 * its notes ("Add the sample notes"), but no browser may ever OWN it:
 * otherwise someone could set this cookie by hand and edit the samples that
 * everyone else copies.
 */
export const SAMPLE_OWNER_ID = '00000000-0000-4000-8000-000000000016'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A cookie value we accept as a notebook id. */
export function isNotebookId(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value) && value !== SAMPLE_OWNER_ID
}

export function isUuid(value: string): boolean {
  return UUID.test(value)
}
