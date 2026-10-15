import type { ListQuery } from '@/lib/schema/note'

/**
 * The list's state lives in the URL (?q=...&tag=...), so a search can be
 * shared, bookmarked and survives a refresh. Links to a note carry the same
 * query, so the list beside the editor keeps its filter.
 */
export function listQueryString(query: Partial<ListQuery>): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.tag) params.set('tag', query.tag)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
